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
exports.CacheStore = void 0;
const indexed_db_1 = require("./indexed-db");
const tx_store_1 = require("./tx-store");
class CacheStore {
    constructor(wallet) {
        this.store = new Map();
        this.wallet = wallet;
        let { uid, network } = wallet;
        console.log("CacheStore:wallet:uid", uid);
        let sNetwork = tx_store_1.internalNames[network] || network;
        if (typeof indexedDB != "undefined")
            this.idb = new indexed_db_1.iDB({ storeName: "cache", dbName: "kaspa_" + uid + "_" + sNetwork });
    }
    setAddressIndexes(data) {
        let item = Object.assign({
            id: "address-indexes",
            ts: Date.now()
        }, data);
        this.set(item);
    }
    getAddressIndexes() {
        return this.get("address-indexes");
    }
    set(item, skipSave = false) {
        this.store.set(item.id, item);
        this.emitCache(item);
        if (!skipSave)
            this.save(item);
    }
    get(id) {
        return this.store.get(id);
    }
    save(item) {
        var _a;
        (_a = this.idb) === null || _a === void 0 ? void 0 : _a.set(item.id, JSON.stringify(item));
    }
    emitCache(item) {
        this.wallet.emit("wallet-cache", item);
    }
    restore() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.idb) {
                let entries = (yield this.idb.entries().catch((err) => {
                    console.log("cache-store: entries():error", err);
                })) || [];
                let length = entries.length;
                console.log("cache idb entries:", entries);
                let list = [];
                for (let i = 0; i < length; i++) {
                    let [key, cacheStr] = entries[i];
                    if (!cacheStr)
                        continue;
                    try {
                        let cacheItem = JSON.parse(cacheStr);
                        list.push(cacheItem);
                    }
                    catch (e) {
                        this.wallet.logger.error("CACHE parse error - 104:", cacheStr, e);
                    }
                }
                list.sort((a, b) => {
                    return a.ts - b.ts;
                }).map(o => {
                    this.set(o, true);
                });
            }
        });
    }
}
exports.CacheStore = CacheStore;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2FjaGUtc3RvcmUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi93YWxsZXQvY2FjaGUtc3RvcmUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7O0FBQ0EsNkNBQWlDO0FBQ2pDLHlDQUF3QztBQWF4QyxNQUFhLFVBQVU7SUFLdEIsWUFBWSxNQUFhO1FBSHpCLFVBQUssR0FBK0IsSUFBSSxHQUFHLEVBQUUsQ0FBQztRQUk3QyxJQUFJLENBQUMsTUFBTSxHQUFHLE1BQU0sQ0FBQztRQUNyQixJQUFJLEVBQUMsR0FBRyxFQUFFLE9BQU8sRUFBQyxHQUFHLE1BQU0sQ0FBQztRQUN0QixPQUFPLENBQUMsR0FBRyxDQUFDLHVCQUF1QixFQUFFLEdBQUcsQ0FBQyxDQUFBO1FBQy9DLElBQUksUUFBUSxHQUFVLHdCQUFhLENBQUMsT0FBTyxDQUFDLElBQUUsT0FBTyxDQUFDO1FBQ3RELElBQUcsT0FBTyxTQUFTLElBQUksV0FBVztZQUNqQyxJQUFJLENBQUMsR0FBRyxHQUFHLElBQUksZ0JBQUcsQ0FBQyxFQUFDLFNBQVMsRUFBQyxPQUFPLEVBQUUsTUFBTSxFQUFDLFFBQVEsR0FBQyxHQUFHLEdBQUMsR0FBRyxHQUFDLFFBQVEsRUFBQyxDQUFDLENBQUM7SUFDekUsQ0FBQztJQUVELGlCQUFpQixDQUFDLElBQTRCO1FBQzFDLElBQUksSUFBSSxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUM7WUFDckIsRUFBRSxFQUFFLGlCQUFpQjtZQUNyQixFQUFFLEVBQUUsSUFBSSxDQUFDLEdBQUcsRUFBRTtTQUNqQixFQUFFLElBQUksQ0FBQyxDQUFDO1FBRVQsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQTtJQUNsQixDQUFDO0lBQ0QsaUJBQWlCO1FBQ2IsT0FBTyxJQUFJLENBQUMsR0FBRyxDQUFDLGlCQUFpQixDQUFzQyxDQUFBO0lBQzNFLENBQUM7SUFFSSxHQUFHLENBQUMsSUFBbUIsRUFBRSxRQUFRLEdBQUMsS0FBSztRQUM5QyxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxFQUFFLElBQUksQ0FBQyxDQUFDO1FBQzlCLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDckIsSUFBRyxDQUFDLFFBQVE7WUFDWCxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ2xCLENBQUM7SUFFVSxHQUFHLENBQUMsRUFBUztRQUNqQixPQUFPLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxDQUFDO0lBQzlCLENBQUM7SUFFSixJQUFJLENBQUMsSUFBbUI7O1FBQ3ZCLE1BQUEsSUFBSSxDQUFDLEdBQUcsMENBQUUsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFBO0lBQzdDLENBQUM7SUFDRCxTQUFTLENBQUMsSUFBbUI7UUFDdEIsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsY0FBYyxFQUFFLElBQUksQ0FBQyxDQUFDO0lBQzlDLENBQUM7SUFDSyxPQUFPOztZQUNaLElBQUcsSUFBSSxDQUFDLEdBQUcsRUFBQyxDQUFDO2dCQUNaLElBQUksT0FBTyxHQUFHLENBQUEsTUFBTSxJQUFJLENBQUMsR0FBRyxDQUFDLE9BQU8sRUFBRSxDQUFDLEtBQUssQ0FBQyxDQUFDLEdBQUcsRUFBQyxFQUFFO29CQUNuRCxPQUFPLENBQUMsR0FBRyxDQUFDLDhCQUE4QixFQUFFLEdBQUcsQ0FBQyxDQUFBO2dCQUNqRCxDQUFDLENBQUMsS0FBRSxFQUFFLENBQUM7Z0JBQ1AsSUFBSSxNQUFNLEdBQUcsT0FBTyxDQUFDLE1BQU0sQ0FBQztnQkFDNUIsT0FBTyxDQUFDLEdBQUcsQ0FBQyxvQkFBb0IsRUFBRSxPQUFPLENBQUMsQ0FBQTtnQkFDMUMsSUFBSSxJQUFJLEdBQW9CLEVBQUUsQ0FBQztnQkFDL0IsS0FBSyxJQUFJLENBQUMsR0FBQyxDQUFDLEVBQUUsQ0FBQyxHQUFDLE1BQU0sRUFBQyxDQUFDLEVBQUUsRUFBQyxDQUFDO29CQUMzQixJQUFJLENBQUMsR0FBRyxFQUFFLFFBQVEsQ0FBQyxHQUFHLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQTtvQkFDaEMsSUFBRyxDQUFDLFFBQVE7d0JBQ1gsU0FBUztvQkFDVixJQUFHLENBQUM7d0JBQ0gsSUFBSSxTQUFTLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsQ0FBQTt3QkFDcEMsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQTtvQkFDckIsQ0FBQztvQkFBQSxPQUFNLENBQUMsRUFBQyxDQUFDO3dCQUNULElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQywwQkFBMEIsRUFBRSxRQUFRLEVBQUUsQ0FBQyxDQUFDLENBQUE7b0JBQ2xFLENBQUM7Z0JBQ0YsQ0FBQztnQkFFRCxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBQyxFQUFFO29CQUNqQixPQUFPLENBQUMsQ0FBQyxFQUFFLEdBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztnQkFDbEIsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQSxFQUFFO29CQUNULElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFBO2dCQUNsQixDQUFDLENBQUMsQ0FBQTtZQUNILENBQUM7UUFDRixDQUFDO0tBQUE7Q0FDRDtBQXRFRCxnQ0FzRUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQge1dhbGxldH0gZnJvbSAnLi93YWxsZXQnO1xuaW1wb3J0IHtpREJ9IGZyb20gJy4vaW5kZXhlZC1kYic7XG5pbXBvcnQge2ludGVybmFsTmFtZXN9IGZyb20gJy4vdHgtc3RvcmUnXG5cbmV4cG9ydCBpbnRlcmZhY2UgQ2FjaGVTdG9yZUl0ZW17XG4gICAgaWQ6c3RyaW5nO1xuICAgIHRzOm51bWJlcjtcbn1cbmV4cG9ydCBpbnRlcmZhY2UgQ2FjaGVJdGVtQWRkcmVzc0luZGV4ZXN7XG4gICAgaWQ/OnN0cmluZztcbiAgICB0cz86bnVtYmVyO1xuICAgIHJlY2VpdmU6bnVtYmVyO1xuICAgIGNoYW5nZTpudW1iZXI7XG59XG5cbmV4cG9ydCBjbGFzcyBDYWNoZVN0b3Jle1xuXHR3YWxsZXQ6V2FsbGV0O1xuXHRzdG9yZTpNYXA8c3RyaW5nLCBDYWNoZVN0b3JlSXRlbT4gPSBuZXcgTWFwKCk7XG5cdGlkYjppREJ8dW5kZWZpbmVkO1xuXG5cdGNvbnN0cnVjdG9yKHdhbGxldDpXYWxsZXQpe1xuXHRcdHRoaXMud2FsbGV0ID0gd2FsbGV0O1xuXHRcdGxldCB7dWlkLCBuZXR3b3JrfSA9IHdhbGxldDtcbiAgICAgICAgY29uc29sZS5sb2coXCJDYWNoZVN0b3JlOndhbGxldDp1aWRcIiwgdWlkKVxuXHRcdGxldCBzTmV0d29yazpzdHJpbmcgPSBpbnRlcm5hbE5hbWVzW25ldHdvcmtdfHxuZXR3b3JrO1xuXHRcdGlmKHR5cGVvZiBpbmRleGVkREIgIT0gXCJ1bmRlZmluZWRcIilcblx0XHRcdHRoaXMuaWRiID0gbmV3IGlEQih7c3RvcmVOYW1lOlwiY2FjaGVcIiwgZGJOYW1lOlwia2FzcGFfXCIrdWlkK1wiX1wiK3NOZXR3b3JrfSk7XG4gICAgfVxuXG4gICAgc2V0QWRkcmVzc0luZGV4ZXMoZGF0YTpDYWNoZUl0ZW1BZGRyZXNzSW5kZXhlcyl7XG4gICAgICAgIGxldCBpdGVtID0gT2JqZWN0LmFzc2lnbih7XG4gICAgICAgICAgICBpZDogXCJhZGRyZXNzLWluZGV4ZXNcIixcbiAgICAgICAgICAgIHRzOiBEYXRlLm5vdygpXG4gICAgICAgIH0sIGRhdGEpO1xuXG4gICAgICAgIHRoaXMuc2V0KGl0ZW0pIFxuICAgIH1cbiAgICBnZXRBZGRyZXNzSW5kZXhlcygpe1xuICAgICAgICByZXR1cm4gdGhpcy5nZXQoXCJhZGRyZXNzLWluZGV4ZXNcIikgYXMgQ2FjaGVJdGVtQWRkcmVzc0luZGV4ZXN8dW5kZWZpbmVkXG4gICAgfVxuXG5cdHByaXZhdGUgc2V0KGl0ZW06Q2FjaGVTdG9yZUl0ZW0sIHNraXBTYXZlPWZhbHNlKXtcblx0XHR0aGlzLnN0b3JlLnNldChpdGVtLmlkLCBpdGVtKTtcblx0XHR0aGlzLmVtaXRDYWNoZShpdGVtKTtcblx0XHRpZighc2tpcFNhdmUpXG5cdFx0XHR0aGlzLnNhdmUoaXRlbSk7XG5cdH1cblxuICAgIHByaXZhdGUgZ2V0KGlkOnN0cmluZyl7XG4gICAgICAgIHJldHVybiB0aGlzLnN0b3JlLmdldChpZCk7XG4gICAgfVxuXG5cdHNhdmUoaXRlbTpDYWNoZVN0b3JlSXRlbSl7XG5cdFx0dGhpcy5pZGI/LnNldChpdGVtLmlkLCBKU09OLnN0cmluZ2lmeShpdGVtKSlcblx0fVxuXHRlbWl0Q2FjaGUoaXRlbTpDYWNoZVN0b3JlSXRlbSl7XG4gICAgICAgIHRoaXMud2FsbGV0LmVtaXQoXCJ3YWxsZXQtY2FjaGVcIiwgaXRlbSk7XG5cdH1cblx0YXN5bmMgcmVzdG9yZSgpe1xuXHRcdGlmKHRoaXMuaWRiKXtcblx0XHRcdGxldCBlbnRyaWVzID0gYXdhaXQgdGhpcy5pZGIuZW50cmllcygpLmNhdGNoKChlcnIpPT57XG5cdFx0XHRcdGNvbnNvbGUubG9nKFwiY2FjaGUtc3RvcmU6IGVudHJpZXMoKTplcnJvclwiLCBlcnIpXG5cdFx0XHR9KXx8W107XG5cdFx0XHRsZXQgbGVuZ3RoID0gZW50cmllcy5sZW5ndGg7XG5cdFx0XHRjb25zb2xlLmxvZyhcImNhY2hlIGlkYiBlbnRyaWVzOlwiLCBlbnRyaWVzKVxuXHRcdFx0bGV0IGxpc3Q6Q2FjaGVTdG9yZUl0ZW1bXSA9IFtdO1xuXHRcdFx0Zm9yIChsZXQgaT0wOyBpPGxlbmd0aDtpKyspe1xuXHRcdFx0XHRsZXQgW2tleSwgY2FjaGVTdHJdID0gZW50cmllc1tpXVxuXHRcdFx0XHRpZighY2FjaGVTdHIpXG5cdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdHRyeXtcblx0XHRcdFx0XHRsZXQgY2FjaGVJdGVtID0gSlNPTi5wYXJzZShjYWNoZVN0cilcblx0XHRcdFx0XHRsaXN0LnB1c2goY2FjaGVJdGVtKVxuXHRcdFx0XHR9Y2F0Y2goZSl7XG5cdFx0XHRcdFx0dGhpcy53YWxsZXQubG9nZ2VyLmVycm9yKFwiQ0FDSEUgcGFyc2UgZXJyb3IgLSAxMDQ6XCIsIGNhY2hlU3RyLCBlKVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdGxpc3Quc29ydCgoYSwgYik9Pntcblx0XHRcdFx0cmV0dXJuIGEudHMtYi50cztcblx0XHRcdH0pLm1hcChvPT57XG5cdFx0XHRcdHRoaXMuc2V0KG8sIHRydWUpXG5cdFx0XHR9KVxuXHRcdH1cblx0fVxufVxuIl19