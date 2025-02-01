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
exports.KaspaAPI = exports.ApiError = void 0;
const event_target_impl_1 = require("./event-target-impl");
class ApiError {
    constructor(message, debugInfo = null) {
        //super(...args);
        this.name = 'ApiError';
        this.message = message;
        this.debugInfo = debugInfo;
        if (!Error.captureStackTrace)
            this.stack = ((new Error(message)).stack + "").split("↵").join("\n");
        else
            Error.captureStackTrace(this, ApiError);
    }
    setDebugInfo(info) {
        this.debugInfo = info;
    }
    setExtraDebugInfo(info) {
        this.extraDebugInfo = info;
    }
}
exports.ApiError = ApiError;
const missingRPCProviderError = () => {
    throw new ApiError(`RPC privider is missing. Please set RPC using 
		Wallet.setRPC(rpc_provider).`);
};
class KaspaAPI extends event_target_impl_1.EventTargetImpl {
    constructor() {
        super(...arguments);
        this.isConnected = false;
    }
    // constructor(rpc:IRPC) {
    // 	this.rpc = rpc;
    // }
    setRPC(rpc) {
        this.rpc = rpc;
        rpc.onConnect(() => {
            this._setConnected(true);
        });
        rpc.onDisconnect(() => {
            this._setConnected(false);
        });
    }
    getRPC() {
        // @ts-ignore
        return this.rpc;
    }
    on(type, callback) {
        super.on(type, callback);
        if (type == 'connect' && this.isConnected) {
            //console.log("api.on->connect", this.isConnected, callback)
            callback({}, { type, detail: {}, defaultPrevented: false });
        }
    }
    _setConnected(isConnected) {
        //console.log("wallet.api._setConnected", isConnected)
        this.isConnected = isConnected;
        this.emit(isConnected ? "connect" : 'disconnect');
    }
    buildUtxoMap(entries) {
        let result = new Map();
        entries.map(entry => {
            //console.log("entry", entry)
            let { transactionId, index } = entry.outpoint;
            let { address, utxoEntry } = entry;
            let { amount, scriptPublicKey, blockDaaScore, isCoinbase } = utxoEntry;
            let item = {
                amount,
                scriptPublicKey,
                blockDaaScore,
                transactionId,
                index,
                isCoinbase
            };
            let items = result.get(address);
            if (!items) {
                items = [];
                result.set(address, items);
            }
            items.push(item);
        });
        return result;
    }
    buildOutpointMap(outpoints) {
        const map = new Map();
        outpoints.map(item => {
            let list = map.get(item.address);
            if (!list) {
                list = [];
                map.set(item.address, list);
            }
            list.push(item.outpoint);
        });
        return map;
    }
    getVirtualSelectedParentBlueScore() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.rpc)
                return missingRPCProviderError();
            const response = yield this.rpc.getVirtualSelectedParentBlueScore()
                .catch((e) => {
                throw new ApiError(`API connection error. ${e}`);
            });
            if (response.error)
                throw new ApiError(`API error (${response.error.errorCode}): ${response.error.message}`);
            return { blueScore: response.blueScore };
        });
    }
    getVirtualDaaScore() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.rpc)
                return missingRPCProviderError();
            const response = yield this.rpc.getBlockDagInfo()
                .catch((e) => {
                throw new ApiError(`API connection error. ${e}`);
            });
            if (response.error)
                throw new ApiError(`API error (${response.error.errorCode}): ${response.error.message}`);
            return { virtualDaaScore: response.virtualDaaScore };
        });
    }
    subscribeVirtualSelectedParentBlueScoreChanged(callback) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.rpc)
                return missingRPCProviderError();
            const response = yield this.rpc.subscribeVirtualSelectedParentBlueScoreChanged(callback)
                .catch((e) => {
                throw new ApiError(`API connection error. ${e}`);
            });
            if (response.error)
                throw new ApiError(`API error (${response.error.errorCode}): ${response.error.message}`);
            return response;
        });
    }
    subscribeVirtualDaaScoreChanged(callback) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.rpc)
                return missingRPCProviderError();
            const response = yield this.rpc.subscribeVirtualDaaScoreChanged(callback)
                .catch((e) => {
                throw new ApiError(`API connection error. ${e}`);
            });
            if (response.error)
                throw new ApiError(`API error (${response.error.errorCode}): ${response.error.message}`);
            return response;
        });
    }
    subscribeUtxosChanged(addresses, callback) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.rpc)
                return missingRPCProviderError();
            const cb = (res) => {
                // console.log("UtxosChangedNotification:", res)
                const added = this.buildUtxoMap(res.added);
                const removed = this.buildOutpointMap(res.removed);
                callback(added, removed);
            };
            let p = this.rpc.subscribeUtxosChanged(addresses, cb);
            let { _utxosChangedSubUid } = this;
            let { uid } = p;
            this._utxosChangedSubUid = uid;
            const response = yield p.catch((e) => {
                throw new ApiError(`API connection error. ${e}`);
            });
            if (_utxosChangedSubUid)
                this.rpc.unSubscribeUtxosChanged(_utxosChangedSubUid);
            if (response.error)
                throw new ApiError(`API error (${response.error.errorCode}): ${response.error.message}`);
            return response;
        });
    }
    getUtxosByAddresses(addresses) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.rpc)
                return missingRPCProviderError();
            const response = yield this.rpc.getUtxosByAddresses(addresses).catch((e) => {
                throw new ApiError(`API connection error. ${e}`);
            });
            if (response.error)
                throw new ApiError(`API error (${response.error.errorCode}): ${response.error.message}`);
            return this.buildUtxoMap(response.entries);
        });
    }
    submitTransaction(tx) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log(tx);
            if (!this.rpc)
                return missingRPCProviderError();
            // eslint-disable-next-line
            const response = yield this.rpc.submitTransaction(tx).catch((e) => {
                throw new ApiError(`API connection error. ${e}`); // eslint-disable-line
            });
            console.log("submitTransaction:result", response);
            if (response.transactionId)
                return response.transactionId;
            if (!response.error)
                response.error = { message: 'Api error. Please try again later. (ERROR: SUBMIT-TX:100)' };
            if (!response.error.errorCode)
                response.error.errorCode = 100;
            throw new ApiError(`API error (${response.error.errorCode}): ${response.error.message}`, tx);
        });
    }
    getBlock(blockHash) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.rpc)
                return missingRPCProviderError();
            // eslint-disable-next-line
            const response = yield this.rpc.getBlock(blockHash).catch((e) => {
                throw new ApiError(`API connection error. ${e}`); // eslint-disable-line
            });
            if (response.error)
                throw new ApiError(`API error (${response.error.errorCode}): ${response.error.message}`);
            return response.blockVerboseData;
        });
    }
    ;
    // TODO: handle pagination
    getTransactionsByAddresses(addresses_1) {
        return __awaiter(this, arguments, void 0, function* (addresses, startingBlockHash = "") {
            if (!this.rpc)
                return missingRPCProviderError();
            const response = yield this.rpc.getTransactionsByAddresses(startingBlockHash, addresses).catch((e) => {
                throw new ApiError(`API connection error. ${e}`);
            });
            if (response.error)
                throw new ApiError(`API error (${response.error.errorCode}): ${response.error.message}`);
            let { transactions, lasBlockScanned } = response;
            return { transactions, lasBlockScanned };
        });
    }
}
exports.KaspaAPI = KaspaAPI;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBpLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vd2FsbGV0L2FwaS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7QUFDQSwyREFBbUU7QUFDbkUsTUFBYSxRQUFRO0lBT3BCLFlBQVksT0FBYyxFQUFFLFlBQWMsSUFBSTtRQUM3QyxpQkFBaUI7UUFDakIsSUFBSSxDQUFDLElBQUksR0FBRyxVQUFVLENBQUM7UUFDdkIsSUFBSSxDQUFDLE9BQU8sR0FBRyxPQUFPLENBQUM7UUFDdkIsSUFBSSxDQUFDLFNBQVMsR0FBRyxTQUFTLENBQUM7UUFDM0IsSUFBSSxDQUFDLEtBQUssQ0FBQyxpQkFBaUI7WUFDM0IsSUFBSSxDQUFDLEtBQUssR0FBRyxDQUFDLENBQUMsSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxLQUFLLEdBQUMsRUFBRSxDQUFDLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQzs7WUFFbkUsS0FBSyxDQUFDLGlCQUFpQixDQUFDLElBQUksRUFBRSxRQUFRLENBQUMsQ0FBQztJQUMxQyxDQUFDO0lBRUQsWUFBWSxDQUFDLElBQVE7UUFDcEIsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUM7SUFDdkIsQ0FBQztJQUVELGlCQUFpQixDQUFDLElBQVE7UUFDekIsSUFBSSxDQUFDLGNBQWMsR0FBRyxJQUFJLENBQUM7SUFDNUIsQ0FBQztDQUNEO0FBekJELDRCQXlCQztBQUVELE1BQU0sdUJBQXVCLEdBQUcsR0FBRSxFQUFFO0lBQ25DLE1BQU0sSUFBSSxRQUFRLENBQUM7K0JBQ1csQ0FBQyxDQUFDO0FBQ2pDLENBQUMsQ0FBQTtBQUVELE1BQU0sUUFBUyxTQUFRLG1DQUFlO0lBQXRDOztRQUdDLGdCQUFXLEdBQVcsS0FBSyxDQUFDO0lBZ1A3QixDQUFDO0lBN09BLDBCQUEwQjtJQUMxQixtQkFBbUI7SUFDbkIsSUFBSTtJQUVKLE1BQU0s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U0FBUyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUU7Z0JBQ3BHLE1BQU0sSUFBSSxRQUFRLENBQUMseUJBQXlCLENBQUMsRUFBRSxDQUFDLENBQUM7WUFDbEQsQ0FBQyxDQUFDLENBQUM7WUFFSCxJQUFJLFFBQVEsQ0FBQyxLQUFLO2dCQUNqQixNQUFNLElBQUksUUFBUSxDQUFDLGNBQWMsUUFBUSxDQUFDLEtBQUssQ0FBQyxTQUFTLE1BQU0sUUFBUSxDQUFDLEtBQUssQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDO1lBRTFGLElBQUksRUFBQyxZQUFZLEVBQUUsZUFBZSxFQUFDLEdBQUcsUUFBUSxDQUFDO1lBQy9DLE9BQU8sRUFBRSxZQUFZLEVBQUUsZUFBZSxFQUFFLENBQUE7UUFDekMsQ0FBQztLQUFBO0NBQ0Q7QUFFUSw0QkFBUSIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEFwaSwgSVJQQywgUlBDIH0gZnJvbSAnY3VzdG9tLXR5cGVzJztcbmltcG9ydCB7RXZlbnRUYXJnZXRJbXBsLCBFdmVudExpc3RlbmVyfSBmcm9tICcuL2V2ZW50LXRhcmdldC1pbXBsJztcbmV4cG9ydCBjbGFzcyBBcGlFcnJvcntcblx0Ly8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1leHBsaWNpdC1hbnlcblx0bmFtZTpzdHJpbmc7XG5cdG1lc3NhZ2U6c3RyaW5nO1xuXHRzdGFjazphbnk7XG5cdGRlYnVnSW5mbzphbnk7XG5cdGV4dHJhRGVidWdJbmZvOmFueTtcblx0Y29uc3RydWN0b3IobWVzc2FnZTpzdHJpbmcsIGRlYnVnSW5mbzphbnk9bnVsbCkge1xuXHRcdC8vc3VwZXIoLi4uYXJncyk7XG5cdFx0dGhpcy5uYW1lID0gJ0FwaUVycm9yJztcblx0XHR0aGlzLm1lc3NhZ2UgPSBtZXNzYWdlO1xuXHRcdHRoaXMuZGVidWdJbmZvID0gZGVidWdJbmZvO1xuXHRcdGlmICghRXJyb3IuY2FwdHVyZVN0YWNrVHJhY2UpXG5cdFx0XHR0aGlzLnN0YWNrID0gKChuZXcgRXJyb3IobWVzc2FnZSkpLnN0YWNrK1wiXCIpLnNwbGl0KFwi4oa1XCIpLmpvaW4oXCJcXG5cIik7XG5cdFx0ZWxzZVxuXHRcdFx0RXJyb3IuY2FwdHVyZVN0YWNrVHJhY2UodGhpcywgQXBpRXJyb3IpO1xuXHR9XG5cblx0c2V0RGVidWdJbmZvKGluZm86YW55KXtcblx0XHR0aGlzLmRlYnVnSW5mbyA9IGluZm87XG5cdH1cblxuXHRzZXRFeHRyYURlYnVnSW5mbyhpbmZvOmFueSl7XG5cdFx0dGhpcy5leHRyYURlYnVnSW5mbyA9IGluZm87XG5cdH1cbn1cblxuY29uc3QgbWlzc2luZ1JQQ1Byb3ZpZGVyRXJyb3IgPSAoKT0+e1xuXHR0aHJvdyBuZXcgQXBpRXJyb3IoYFJQQyBwcml2aWRlciBpcyBtaXNzaW5nLiBQbGVhc2Ugc2V0IFJQQyB1c2luZyBcblx0XHRXYWxsZXQuc2V0UlBDKHJwY19wcm92aWRlcikuYCk7XG59XG5cbmNsYXNzIEthc3BhQVBJIGV4dGVuZHMgRXZlbnRUYXJnZXRJbXBse1xuXG5cdHJwYz86SVJQQztcblx0aXNDb25uZWN0ZWQ6Ym9vbGVhbiA9IGZhbHNlO1xuXHRfdXR4b3NDaGFuZ2VkU3ViVWlkOnN0cmluZ3x1bmRlZmluZWQ7XG5cblx0Ly8gY29uc3RydWN0b3IocnBjOklSUEMpIHtcblx0Ly8gXHR0aGlzLnJwYyA9IHJwYztcblx0Ly8gfVxuXG5cdHNldFJQQyhycGM6SVJQQykge1xuXHRcdHRoaXMucnBjID0gcnBjO1xuXHRcdHJwYy5vbkNvbm5lY3QoKCk9Pntcblx0XHRcdHRoaXMuX3NldENvbm5lY3RlZCh0cnVlKTtcblx0XHR9KVxuXHRcdHJwYy5vbkRpc2Nvbm5lY3QoKCk9Pntcblx0XHRcdHRoaXMuX3NldENvbm5lY3RlZChmYWxzZSk7XG5cdFx0fSlcblx0fVxuXG5cdGdldFJQQygpOklSUEMge1xuXHRcdC8vIEB0cy1pZ25vcmVcblx0XHRyZXR1cm4gdGhpcy5ycGM7XG5cdH1cblxuXHRvbih0eXBlOnN0cmluZywgY2FsbGJhY2s6RXZlbnRMaXN0ZW5lcil7XG5cdFx0c3VwZXIub24odHlwZSwgY2FsbGJhY2spO1xuXHRcdGlmKHR5cGUgPT0gJ2Nvbm5lY3QnICYmIHRoaXMuaXNDb25uZWN0ZWQpe1xuXHRcdFx0Ly9jb25zb2xlLmxvZyhcImFwaS5vbi0+Y29ubmVjdFwiLCB0aGlzLmlzQ29ubmVjdGVkLCBjYWxsYmFjaylcblx0XHRcdGNhbGxiYWNrKHt9LCB7dHlwZSwgZGV0YWlsOnt9LCBkZWZhdWx0UHJldmVudGVkOmZhbHNlfSk7XG5cdFx0fVxuXG5cdH1cblx0X3NldENvbm5lY3RlZChpc0Nvbm5lY3RlZDpib29sZWFuKXtcblx0XHQvL2NvbnNvbGUubG9nKFwid2FsbGV0LmFwaS5fc2V0Q29ubmVjdGVkXCIsIGlzQ29ubmVjdGVkKVxuXHRcdHRoaXMuaXNDb25uZWN0ZWQgPSBpc0Nvbm5lY3RlZDtcblx0XHR0aGlzLmVtaXQoaXNDb25uZWN0ZWQ/XCJjb25uZWN0XCI6J2Rpc2Nvbm5lY3QnKTtcblx0fVxuXG5cdGJ1aWxkVXR4b01hcChlbnRyaWVzOlJQQy5VVFhPc0J5QWRkcmVzc2VzRW50cnlbXSk6TWFwPHN0cmluZywgQXBpLlV0eG9bXT4ge1xuXHRcdGxldCByZXN1bHQ6TWFwPHN0cmluZywgQXBpLlV0eG9bXT4gPSBuZXcgTWFwKCk7XG5cdFx0ZW50cmllcy5tYXAoZW50cnk9Pntcblx0XHRcdC8vY29uc29sZS5sb2coXCJlbnRyeVwiLCBlbnRyeSlcblx0XHRcdGxldCB7dHJhbnNhY3Rpb25JZCwgaW5kZXh9ID0gZW50cnkub3V0cG9pbnQ7XG5cdFx0XHRsZXQge2FkZHJlc3MsIHV0eG9FbnRyeX0gPSBlbnRyeTtcblx0XHRcdGxldCB7YW1vdW50LCBzY3JpcHRQdWJsaWNLZXksIGJsb2NrRGFhU2NvcmUsIGlzQ29pbmJhc2V9ID0gdXR4b0VudHJ5O1xuXG5cdFx0XHRsZXQgaXRlbTogQXBpLlV0eG8gPSB7XG5cdFx0XHRcdGFtb3VudCxcblx0XHRcdFx0c2NyaXB0UHVibGljS2V5LFxuXHRcdFx0XHRibG9ja0RhYVNjb3JlLFxuXHRcdFx0XHR0cmFuc2FjdGlvbklkLFxuXHRcdFx0XHRpbmRleCxcblx0XHRcdFx0aXNDb2luYmFzZVxuXHRcdFx0fVxuXG5cdFx0XHRsZXQgaXRlbXM6QXBpLlV0eG9bXXx1bmRlZmluZWQgPSByZXN1bHQuZ2V0KGFkZHJlc3MpO1xuXHRcdFx0aWYoIWl0ZW1zKXtcblx0XHRcdFx0aXRlbXMgPSBbXTtcblx0XHRcdFx0cmVzdWx0LnNldChhZGRyZXNzLCBpdGVtcyk7XG5cdFx0XHR9XG5cblx0XHRcdGl0ZW1zLnB1c2goaXRlbSk7XG5cdFx0fSk7XG5cblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cblx0YnVpbGRPdXRwb2ludE1hcChvdXRwb2ludHM6IHthZGRyZXNzOnN0cmluZywgb3V0cG9pbnQ6UlBDLk91dHBvaW50fVtdKTpNYXA8c3RyaW5nLCBSUEMuT3V0cG9pbnRbXT4ge1xuXHRcdGNvbnN0IG1hcDpNYXA8c3RyaW5nLCBSUEMuT3V0cG9pbnRbXT4gPSBuZXcgTWFwKCk7XG5cdFx0b3V0cG9pbnRzLm1hcChpdGVtPT57XG5cdFx0XHRsZXQgbGlzdDpSUEMuT3V0cG9pbnRbXXx1bmRlZmluZWQgPSBtYXAuZ2V0KGl0ZW0uYWRkcmVzcyk7XG5cdFx0XHRpZighbGlzdCl7XG5cdFx0XHRcdGxpc3QgPSBbXTtcblx0XHRcdFx0bWFwLnNldChpdGVtLmFkZHJlc3MsIGxpc3QpO1xuXHRcdFx0fVxuXG5cdFx0XHRsaXN0LnB1c2goaXRlbS5vdXRwb2ludCk7XG5cdFx0fSk7XG5cblx0XHRyZXR1cm4gbWFwO1xuXHR9XG5cblx0YXN5bmMgZ2V0VmlydHVhbFNlbGVjdGVkUGFyZW50Qmx1ZVNjb3JlKCk6IFByb21pc2U8e2JsdWVTY29yZTpudW1iZXJ9PiB7XG5cdFx0aWYoIXRoaXMucnBjKVxuXHRcdFx0cmV0dXJuIG1pc3NpbmdSUENQcm92aWRlckVycm9yKCk7XG5cblx0XHRjb25zdCByZXNwb25zZSA9IGF3YWl0IHRoaXMucnBjLmdldFZpcnR1YWxTZWxlY3RlZFBhcmVudEJsdWVTY29yZSgpXG5cdFx0LmNhdGNoKChlKSA9PiB7XG5cdFx0XHR0aHJvdyBuZXcgQXBpRXJyb3IoYEFQSSBjb25uZWN0aW9uIGVycm9yLiAke2V9YCk7XG5cdFx0fSlcblx0XHRcblx0XHRpZiAocmVzcG9uc2UuZXJyb3IpXG5cdFx0XHR0aHJvdyBuZXcgQXBpRXJyb3IoYEFQSSBlcnJvciAoJHtyZXNwb25zZS5lcnJvci5lcnJvckNvZGV9KTogJHtyZXNwb25zZS5lcnJvci5tZXNzYWdlfWApO1xuXG5cdFx0cmV0dXJuIHtibHVlU2NvcmU6IHJlc3BvbnNlLmJsdWVTY29yZX1cblx0fVxuXHRcblx0YXN5bmMgZ2V0VmlydHVhbERhYVNjb3JlKCk6IFByb21pc2U8e3ZpcnR1YWxEYWFTY29yZTpudW1iZXJ9PiB7XG5cdFx0aWYoIXRoaXMucnBjKVxuXHRcdFx0cmV0dXJuIG1pc3NpbmdSUENQcm92aWRlckVycm9yKCk7XG5cblx0XHRjb25zdCByZXNwb25zZSA9IGF3YWl0IHRoaXMucnBjLmdldEJsb2NrRGFnSW5mbygpXG5cdFx0LmNhdGNoKChlKSA9PiB7XG5cdFx0XHR0aHJvdyBuZXcgQXBpRXJyb3IoYEFQSSBjb25uZWN0aW9uIGVycm9yLiAke2V9YCk7XG5cdFx0fSlcblx0XHRcblx0XHRpZiAocmVzcG9uc2UuZXJyb3IpXG5cdFx0XHR0aHJvdyBuZXcgQXBpRXJyb3IoYEFQSSBlcnJvciAoJHtyZXNwb25zZS5lcnJvci5lcnJvckNvZGV9KTogJHtyZXNwb25zZS5lcnJvci5tZXNzYWdlfWApO1xuXG5cdFx0cmV0dXJuIHt2aXJ0dWFsRGFhU2NvcmU6IHJlc3BvbnNlLnZpcnR1YWxEYWFTY29yZX1cblx0fVxuXHRcblxuXHRhc3luYyBzdWJzY3JpYmVWaXJ0dWFsU2VsZWN0ZWRQYXJlbnRCbHVlU2NvcmVDaGFuZ2VkKGNhbGxiYWNrOlJQQy5jYWxsYmFjazxSUEMuVmlydHVhbFNlbGVjdGVkUGFyZW50Qmx1ZVNjb3JlQ2hhbmdlZE5vdGlmaWNhdGlvbj4pIHtcblx0XHRpZighdGhpcy5ycGMpXG5cdFx0XHRyZXR1cm4gbWlzc2luZ1JQQ1Byb3ZpZGVyRXJyb3IoKTtcblxuXHRcdGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgdGhpcy5ycGMuc3Vic2NyaWJlVmlydHVhbFNlbGVjdGVkUGFyZW50Qmx1ZVNjb3JlQ2hhbmdlZChjYWxsYmFjaylcblx0XHQuY2F0Y2goKGUpID0+IHtcblx0XHRcdHRocm93IG5ldyBBcGlFcnJvcihgQVBJIGNvbm5lY3Rpb24gZXJyb3IuICR7ZX1gKTtcblx0XHR9KVxuXHRcdFxuXHRcdGlmIChyZXNwb25zZS5lcnJvcilcblx0XHRcdHRocm93IG5ldyBBcGlFcnJvcihgQVBJIGVycm9yICgke3Jlc3BvbnNlLmVycm9yLmVycm9yQ29kZX0pOiAke3Jlc3BvbnNlLmVycm9yLm1lc3NhZ2V9YCk7XG5cblx0XHRyZXR1cm4gcmVzcG9uc2U7XG5cdH1cblxuXHRhc3luYyBzdWJzY3JpYmVWaXJ0dWFsRGFhU2NvcmVDaGFuZ2VkKGNhbGxiYWNrOlJQQy5jYWxsYmFjazxSUEMuVmlydHVhbERhYVNjb3JlQ2hhbmdlZE5vdGlmaWNhdGlvbj4pIHtcblx0XHRpZighdGhpcy5ycGMpXG5cdFx0XHRyZXR1cm4gbWlzc2luZ1JQQ1Byb3ZpZGVyRXJyb3IoKTtcblxuXHRcdGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgdGhpcy5ycGMuc3Vic2NyaWJlVmlydHVhbERhYVNjb3JlQ2hhbmdlZChjYWxsYmFjaylcblx0XHQuY2F0Y2goKGUpID0+IHtcblx0XHRcdHRocm93IG5ldyBBcGlFcnJvcihgQVBJIGNvbm5lY3Rpb24gZXJyb3IuICR7ZX1gKTtcblx0XHR9KVxuXHRcdFxuXHRcdGlmIChyZXNwb25zZS5lcnJvcilcblx0XHRcdHRocm93IG5ldyBBcGlFcnJvcihgQVBJIGVycm9yICgke3Jlc3BvbnNlLmVycm9yLmVycm9yQ29kZX0pOiAke3Jlc3BvbnNlLmVycm9yLm1lc3NhZ2V9YCk7XG5cblx0XHRyZXR1cm4gcmVzcG9uc2U7XG5cdH1cblxuXHRhc3luYyBzdWJzY3JpYmVVdHhvc0NoYW5nZWQoYWRkcmVzc2VzOnN0cmluZ1tdLCBjYWxsYmFjazooYWRkZWQ6TWFwPHN0cmluZywgQXBpLlV0eG9bXT4sIHJlbW92ZWQ6TWFwPHN0cmluZywgUlBDLk91dHBvaW50W10+KT0+dm9pZCkge1xuXHRcdGlmKCF0aGlzLnJwYylcblx0XHRcdHJldHVybiBtaXNzaW5nUlBDUHJvdmlkZXJFcnJvcigpO1xuXG5cdFx0Y29uc3QgY2I6UlBDLmNhbGxiYWNrPFJQQy5VdHhvc0NoYW5nZWROb3RpZmljYXRpb24+ID0gKHJlcyk9Pntcblx0XHRcdC8vIGNvbnNvbGUubG9nKFwiVXR4b3NDaGFuZ2VkTm90aWZpY2F0aW9uOlwiLCByZXMpXG5cdFx0XHRjb25zdCBhZGRlZCA9IHRoaXMuYnVpbGRVdHhvTWFwKHJlcy5hZGRlZCk7XG5cdFx0XHRjb25zdCByZW1vdmVkID0gdGhpcy5idWlsZE91dHBvaW50TWFwKHJlcy5yZW1vdmVkKTtcblx0XHRcdGNhbGxiYWNrKGFkZGVkLCByZW1vdmVkKTtcblx0XHR9XG5cdFx0XG5cdFx0bGV0IHAgPSB0aGlzLnJwYy5zdWJzY3JpYmVVdHhvc0NoYW5nZWQoYWRkcmVzc2VzLCBjYilcblx0XHRcblx0XHRsZXQge191dHhvc0NoYW5nZWRTdWJVaWR9ID0gdGhpcztcblxuXHRcdGxldCB7dWlkfSA9IHA7XG5cdFx0dGhpcy5fdXR4b3NDaGFuZ2VkU3ViVWlkID0gdWlkO1xuXG5cdFx0Y29uc3QgcmVzcG9uc2UgPSBhd2FpdCBwLmNhdGNoKChlKSA9PiB7XG5cdFx0XHR0aHJvdyBuZXcgQXBpRXJyb3IoYEFQSSBjb25uZWN0aW9uIGVycm9yLiAke2V9YCk7XG5cdFx0fSlcblxuXHRcdGlmKF91dHhvc0NoYW5nZWRTdWJVaWQpXG5cdFx0XHR0aGlzLnJwYy51blN1YnNjcmliZVV0eG9zQ2hhbmdlZChfdXR4b3NDaGFuZ2VkU3ViVWlkKTtcblx0XHRcblx0XHRcblx0XHRpZiAocmVzcG9uc2UuZXJyb3IpXG5cdFx0XHR0aHJvdyBuZXcgQXBpRXJyb3IoYEFQSSBlcnJvciAoJHtyZXNwb25zZS5lcnJvci5lcnJvckNvZGV9KTogJHtyZXNwb25zZS5lcnJvci5tZXNzYWdlfWApO1xuXG5cdFx0cmV0dXJuIHJlc3BvbnNlO1xuXHR9XG5cblx0YXN5bmMgZ2V0VXR4b3NCeUFkZHJlc3NlcyhhZGRyZXNzZXM6IHN0cmluZ1tdKTogUHJvbWlzZTxNYXA8c3RyaW5nLCBBcGkuVXR4b1tdPj4ge1xuXHRcdGlmKCF0aGlzLnJwYylcblx0XHRcdHJldHVybiBtaXNzaW5nUlBDUHJvdmlkZXJFcnJvcigpO1xuXHRcdFxuXHRcdGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgdGhpcy5ycGMuZ2V0VXR4b3NCeUFkZHJlc3NlcyhhZGRyZXNzZXMpLmNhdGNoKChlKSA9PiB7XG5cdFx0XHR0aHJvdyBuZXcgQXBpRXJyb3IoYEFQSSBjb25uZWN0aW9uIGVycm9yLiAke2V9YCk7XG5cdFx0fSlcblx0XHRcblx0XHRpZiAocmVzcG9uc2UuZXJyb3IpXG5cdFx0XHR0aHJvdyBuZXcgQXBpRXJyb3IoYEFQSSBlcnJvciAoJHtyZXNwb25zZS5lcnJvci5lcnJvckNvZGV9KTogJHtyZXNwb25zZS5lcnJvci5tZXNzYWdlfWApO1xuXG5cblx0XHRyZXR1cm4gdGhpcy5idWlsZFV0eG9NYXAocmVzcG9uc2UuZW50cmllcyk7XG5cdH1cblxuXHRhc3luYyBzdWJtaXRUcmFuc2FjdGlvbih0eDogUlBDLlN1Ym1pdFRyYW5zYWN0aW9uUmVxdWVzdCk6IFByb21pc2U8c3RyaW5nPiB7XG5cdFx0Y29uc29sZS5sb2codHgpO1xuXHRcdGlmKCF0aGlzLnJwYylcblx0XHRcdHJldHVybiBtaXNzaW5nUlBDUHJvdmlkZXJFcnJvcigpO1xuXHRcdC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZVxuXHRcdGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgdGhpcy5ycGMuc3VibWl0VHJhbnNhY3Rpb24odHgpLmNhdGNoKChlKSA9PiB7XG5cdFx0XHR0aHJvdyBuZXcgQXBpRXJyb3IoYEFQSSBjb25uZWN0aW9uIGVycm9yLiAke2V9YCk7IC8vIGVzbGludC1kaXNhYmxlLWxpbmVcblx0XHR9KVxuXHRcdGNvbnNvbGUubG9nKFwic3VibWl0VHJhbnNhY3Rpb246cmVzdWx0XCIsIHJlc3BvbnNlKVxuXHRcdGlmKHJlc3BvbnNlLnRyYW5zYWN0aW9uSWQpXG5cdFx0XHRyZXR1cm4gcmVzcG9uc2UudHJhbnNhY3Rpb25JZDtcblxuXHRcdGlmKCFyZXNwb25zZS5lcnJvcilcblx0XHRcdHJlc3BvbnNlLmVycm9yID0ge21lc3NhZ2U6ICdBcGkgZXJyb3IuIFBsZWFzZSB0cnkgYWdhaW4gbGF0ZXIuIChFUlJPUjogU1VCTUlULVRYOjEwMCknfTtcblx0XHRpZighcmVzcG9uc2UuZXJyb3IuZXJyb3JDb2RlKVxuXHRcdFx0cmVzcG9uc2UuZXJyb3IuZXJyb3JDb2RlID0gMTAwO1xuXG5cdFx0dGhyb3cgbmV3IEFwaUVycm9yKGBBUEkgZXJyb3IgKCR7cmVzcG9uc2UuZXJyb3IuZXJyb3JDb2RlfSk6ICR7cmVzcG9uc2UuZXJyb3IubWVzc2FnZX1gLCB0eCk7XG5cdH1cblxuXG5cdGFzeW5jIGdldEJsb2NrKGJsb2NrSGFzaDogc3RyaW5nKTogUHJvbWlzZTxBcGkuQmxvY2tSZXNwb25zZT4ge1xuXHRcdGlmKCF0aGlzLnJwYylcblx0XHRcdHJldHVybiBtaXNzaW5nUlBDUHJvdmlkZXJFcnJvcigpO1xuXHRcdC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZVxuXHRcdGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgdGhpcy5ycGMuZ2V0QmxvY2soYmxvY2tIYXNoKS5jYXRjaCgoZSkgPT4ge1xuXHRcdFx0dGhyb3cgbmV3IEFwaUVycm9yKGBBUEkgY29ubmVjdGlvbiBlcnJvci4gJHtlfWApOyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lXG5cdFx0fSk7XG5cblx0XHRpZiAocmVzcG9uc2UuZXJyb3IpXG5cdFx0XHR0aHJvdyBuZXcgQXBpRXJyb3IoYEFQSSBlcnJvciAoJHtyZXNwb25zZS5lcnJvci5lcnJvckNvZGV9KTogJHtyZXNwb25zZS5lcnJvci5tZXNzYWdlfWApO1xuXG5cdFx0cmV0dXJuIHJlc3BvbnNlLmJsb2NrVmVyYm9zZURhdGE7XG5cdH07XG5cblx0Ly8gVE9ETzogaGFuZGxlIHBhZ2luYXRpb25cblx0YXN5bmMgZ2V0VHJhbnNhY3Rpb25zQnlBZGRyZXNzZXMoXG5cdFx0YWRkcmVzc2VzOiBzdHJpbmdbXSxcblx0XHRzdGFydGluZ0Jsb2NrSGFzaDogc3RyaW5nID0gXCJcIlxuXHQpOiBQcm9taXNlPEFwaS5UcmFuc2FjdGlvbnNCeUFkZHJlc3Nlc1Jlc3BvbnNlPiB7XG5cdFx0aWYoIXRoaXMucnBjKVxuXHRcdFx0cmV0dXJuIG1pc3NpbmdSUENQcm92aWRlckVycm9yKCk7XG5cdFx0Y29uc3QgcmVzcG9uc2UgPSBhd2FpdCB0aGlzLnJwYy5nZXRUcmFuc2FjdGlvbnNCeUFkZHJlc3NlcyhzdGFydGluZ0Jsb2NrSGFzaCwgYWRkcmVzc2VzKS5jYXRjaCgoZSkgPT4ge1xuXHRcdFx0dGhyb3cgbmV3IEFwaUVycm9yKGBBUEkgY29ubmVjdGlvbiBlcnJvci4gJHtlfWApO1xuXHRcdH0pO1xuXG5cdFx0aWYgKHJlc3BvbnNlLmVycm9yKVxuXHRcdFx0dGhyb3cgbmV3IEFwaUVycm9yKGBBUEkgZXJyb3IgKCR7cmVzcG9uc2UuZXJyb3IuZXJyb3JDb2RlfSk6ICR7cmVzcG9uc2UuZXJyb3IubWVzc2FnZX1gKTtcblxuXHRcdGxldCB7dHJhbnNhY3Rpb25zLCBsYXNCbG9ja1NjYW5uZWR9ID0gcmVzcG9uc2U7XG5cdFx0cmV0dXJuIHsgdHJhbnNhY3Rpb25zLCBsYXNCbG9ja1NjYW5uZWQgfVxuXHR9XG59XG5cbmV4cG9ydCB7IEthc3BhQVBJIH0iXX0=