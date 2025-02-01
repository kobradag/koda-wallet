"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.iDB = void 0;
exports.promisifyRequest = promisifyRequest;
exports.createStore = createStore;
function promisifyRequest(request) {
    return new Promise((resolve, reject) => {
        // @ts-ignore - file size hacks
        request.oncomplete = request.onsuccess = () => resolve(request.result);
        // @ts-ignore - file size hacks
        request.onabort = request.onerror = () => reject(request.error);
    });
}
function createStore(dbName, storeNames, version) {
    //console.log("createStore", dbName, storeNames, version)
    const request = indexedDB.open(dbName, version);
    request.onupgradeneeded = () => {
        const db = request.result;
        let list = db.objectStoreNames;
        storeNames.forEach(storeName => {
            console.log("createStore", storeName, list.contains(storeName), list);
            if (!list.contains(storeName)) {
                let result = db.createObjectStore(storeName);
                console.log("db.createObjectStore:", result);
            }
        });
    };
    const dbp = promisifyRequest(request);
    return {
        dbName,
        getUseStore(storeName) {
            return (txMode, callback) => dbp.then((db) => callback(db.transaction(storeName, txMode).objectStore(storeName)));
        }
    };
}
class iDB {
    static getOrCreateStore(storeName, dbName, version) {
        let store = this.stores.find(s => s.dbName == dbName);
        if (store)
            return store.getUseStore(storeName);
        return createStore(dbName, [storeName], version).getUseStore(storeName);
    }
    static buildDB(dbName, version = 1, storeNames = ["tx", "cache"]) {
        let store = this.stores.find(s => s.dbName == dbName);
        //console.log("iDB.buildDB - A", dbName, version, storeNames)
        if (!store) {
            //console.log("iDB.buildDB - B", storeNames)
            this.stores.push(createStore(dbName, storeNames, version));
        }
    }
    constructor(options) {
        let { storeName, dbName } = options;
        const version = 4;
        iDB.buildDB(dbName, version);
        this.defaultGetStoreFunc = iDB.getOrCreateStore(storeName, dbName, version);
    }
    /**
     * Get a value by its key.
     *
     * @param key
     * @param customStore Method to get a custom store. Use with caution (see the docs).
     */
    get(key, customStore = this.defaultGetStoreFunc) {
        return customStore('readonly', (store) => promisifyRequest(store.get(key)));
    }
    /**
     * Set a value with a key.
     *
     * @param key
     * @param value
     * @param customStore Method to get a custom store. Use with caution (see the docs).
     */
    set(key, value, customStore = this.defaultGetStoreFunc) {
        return customStore('readwrite', (store) => {
            store.put(value, key);
            return promisifyRequest(store.transaction);
        });
    }
    /**
     * Set multiple values at once. This is faster than calling set() multiple times.
     * It's also atomic – if one of the pairs can't be added, none will be added.
     *
     * @param entries Array of entries, where each entry is an array of `[key, value]`.
     * @param customStore Method to get a custom store. Use with caution (see the docs).
     */
    setMany(entries, customStore = this.defaultGetStoreFunc) {
        return customStore('readwrite', (store) => {
            entries.forEach((entry) => store.put(entry[1], entry[0]));
            return promisifyRequest(store.transaction);
        });
    }
    /**
     * Get multiple values by their keys
     *
     * @param keys
     * @param customStore Method to get a custom store. Use with caution (see the docs).
     */
    getMany(keys, customStore = this.defaultGetStoreFunc) {
        return customStore('readonly', (store) => Promise.all(keys.map((key) => promisifyRequest(store.get(key)))));
    }
    /**
     * Update a value. This lets you see the old value and update it as an atomic operation.
     *
     * @param key
     * @param updater A callback that takes the old value and returns a new value.
     * @param customStore Method to get a custom store. Use with caution (see the docs).
     */
    update(key, updater, customStore = this.defaultGetStoreFunc) {
        return customStore('readwrite', (store) => 
        // Need to create the promise manually.
        // If I try to chain promises, the transaction closes in browsers
        // that use a promise polyfill (IE10/11).
        new Promise((resolve, reject) => {
            store.get(key).onsuccess = function () {
                try {
                    store.put(updater(this.result), key);
                    resolve(promisifyRequest(store.transaction));
                }
                catch (err) {
                    reject(err);
                }
            };
        }));
    }
    /**
     * Delete a particular key from the store.
     *
     * @param key
     * @param customStore Method to get a custom store. Use with caution (see the docs).
     */
    del(key, customStore = this.defaultGetStoreFunc) {
        return customStore('readwrite', (store) => {
            store.delete(key);
            return promisifyRequest(store.transaction);
        });
    }
    /**
     * Clear all values in the store.
     *
     * @param customStore Method to get a custom store. Use with caution (see the docs).
     */
    clear(customStore = this.defaultGetStoreFunc) {
        return customStore('readwrite', (store) => {
            store.clear();
            return promisifyRequest(store.transaction);
        });
    }
    eachCursor(customStore, callback) {
        return customStore('readonly', (store) => {
            // This would be store.getAllKeys(), but it isn't supported by Edge or Safari.
            // And openKeyCursor isn't supported by Safari.
            let req = store.openCursor();
            req.onsuccess = function () {
                //console.log("store.openCursor.onsuccess", this)
                if (!this.result)
                    return;
                callback(this.result);
                this.result.continue();
            };
            req.onerror = function (e) {
                console.log("store.openCursor.onerror", e, this);
            };
            return promisifyRequest(store.transaction);
        });
    }
    /**
     * Get all keys in the store.
     *
     * @param customStore Method to get a custom store. Use with caution (see the docs).
     */
    keys(customStore = this.defaultGetStoreFunc) {
        const items = [];
        return this.eachCursor(customStore, (cursor) => items.push(cursor.key)).then(() => items);
    }
    /**
     * Get all values in the store.
     *
     * @param customStore Method to get a custom store. Use with caution (see the docs).
     */
    values(customStore = this.defaultGetStoreFunc) {
        const items = [];
        return this.eachCursor(customStore, (cursor) => items.push(cursor.value)).then(() => items);
    }
    /**
     * Get all entries in the store. Each entry is an array of `[key, value]`.
     *
     * @param customStore Method to get a custom store. Use with caution (see the docs).
     */
    entries(customStore = this.defaultGetStoreFunc) {
        const items = [];
        return this.eachCursor(customStore, (cursor) => items.push([cursor.key, cursor.value])).then(() => items);
    }
}
exports.iDB = iDB;
iDB.stores = [];
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXhlZC1kYi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3dhbGxldC9pbmRleGVkLWRiLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUVBLDRDQVNDO0FBRUQsa0NBeUJDO0FBcENELFNBQWdCLGdCQUFnQixDQUMvQixPQUEwQztJQUUxQyxPQUFPLElBQUksT0FBTyxDQUFRLENBQUMsT0FBTyxFQUFFLE1BQU0sRUFBRSxFQUFFO1FBQzdDLCtCQUErQjtRQUMvQixPQUFPLENBQUMsVUFBVSxHQUFHLE9BQU8sQ0FBQyxTQUFTLEdBQUcsR0FBRyxFQUFFLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUN2RSwrQkFBK0I7UUFDL0IsT0FBTyxDQUFDLE9BQU8sR0FBRyxPQUFPLENBQUMsT0FBTyxHQUFHLEdBQUcsRUFBRSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDakUsQ0FBQyxDQUFDLENBQUM7QUFDSixDQUFDO0FBRUQsU0FBZ0IsV0FBVyxDQUFDLE1BQWMsRUFBRSxVQUFvQixFQUFFLE9BQWM7SUFDL0UseURBQXlEO0lBQ3pELE1BQU0sT0FBTyxHQUFHLFNBQVMsQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLE9BQU8sQ0FBQyxDQUFDO0lBQ2hELE9BQU8sQ0FBQyxlQUFlLEdBQUcsR0FBRyxFQUFFO1FBQzlCLE1BQU0sRUFBRSxHQUFHLE9BQU8sQ0FBQyxNQUFNLENBQUM7UUFDMUIsSUFBSSxJQUFJLEdBQUcsRUFBRSxDQUFDLGdCQUFnQixDQUFDO1FBQy9CLFVBQVUsQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFBLEVBQUU7WUFDN0IsT0FBTyxDQUFDLEdBQUcsQ0FBQyxhQUFhLEVBQUUsU0FBUyxFQUFFLElBQUksQ0FBQyxRQUFRLENBQUMsU0FBUyxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUE7WUFDckUsSUFBRyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsU0FBUyxDQUFDLEVBQUMsQ0FBQztnQkFDN0IsSUFBSSxNQUFNLEdBQUcsRUFBRSxDQUFDLGlCQUFpQixDQUFDLFNBQVMsQ0FBQyxDQUFBO2dCQUM1QyxPQUFPLENBQUMsR0FBRyxDQUFDLHVCQUF1QixFQUFFLE1BQU0sQ0FBQyxDQUFBO1lBQzdDLENBQUM7UUFDRixDQUFDLENBQUMsQ0FBQTtJQUNILENBQUMsQ0FBQztJQUVGLE1BQU0sR0FBRyxHQUFHLGdCQUFnQixDQUFDLE9BQU8sQ0FBQyxDQUFDO0lBRXRDLE9BQU87UUFDTixNQUFNO1FBQ04sV0FBVyxDQUFDLFNBQWdCO1lBQzNCLE9BQU8sQ0FBSSxNQUF5QixFQUFFLFFBQW9CLEVBQUMsRUFBRSxDQUFBLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUM1RSxRQUFRLENBQUMsRUFBRSxDQUFDLFdBQVcsQ0FBQyxTQUFTLEVBQUUsTUFBTSxDQUFDLENBQUMsV0FBVyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQ2xFLENBQUE7UUFDRixDQUFDO0tBQ0EsQ0FBQTtBQUNILENBQUM7QUFnQkQsTUFBYSxHQUFHO0lBSWYsTUFBTSxDQUFDLGdCQUFnQixDQUFDLFNBQWdCLEVBQUUsTUFBYSxFQUFFLE9BQWM7UUFDdEUsSUFBSSxLQUFLLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFBLEVBQUUsQ0FBQSxDQUFDLENBQUMsTUFBTSxJQUFJLE1BQU0sQ0FBQyxDQUFDO1FBQ3BELElBQUcsS0FBSztZQUNQLE9BQU8sS0FBSyxDQUFDLFdBQVcsQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUNyQyxPQUFPLFdBQVcsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxTQUFTLENBQUMsRUFBRSxPQUFPLENBQUMsQ0FBQyxXQUFXLENBQUMsU0FBUyxDQUFDLENBQUM7SUFDekUsQ0FBQztJQUVELE1BQU0sQ0FBQyxPQUFPLENBQUMsTUFBYSxFQUFFLE9BQU8sR0FBQyxDQUFDLEVBQUUsVUFBVSxHQUFDLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQztRQUNsRSxJQUFJLEtBQUssR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUEsRUFBRSxDQUFBLENBQUMsQ0FBQyxNQUFNLElBQUksTUFBTSxDQUFDLENBQUM7UUFDcEQsNkRBQTZEO1FBQzdELElBQUcsQ0FBQyxLQUFLLEVBQUMsQ0FBQztZQUNWLDRDQUE0QztZQUM1QyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsTUFBTSxFQUFFLFVBQVUsRUFBRSxPQUFPLENBQUMsQ0FBQyxDQUFBO1FBQzNELENBQUM7SUFDRixDQUFDO0lBR0QsWUFBWSxPQUF5QztRQUNwRCxJQUFJLEVBQUMsU0FBUyxFQUFFLE1BQU0sRUFBQyxHQUFHLE9BQU8sQ0FBQztRQUNsQyxNQUFNLE9BQU8sR0FBRyxDQUFDLENBQUM7UUFDbEIsR0FBRyxDQUFDLE9BQU8sQ0FBQyxNQUFNLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDN0IsSUFBSSxDQUFDLG1CQUFtQixHQUFHLEdBQUcsQ0FBQyxnQkFBZ0IsQ0FBQyxTQUFTLEVBQUUsTUFBTSxFQUFFLE9BQU8sQ0FBQyxDQUFDO0lBQzdFLENBQUM7SUFFRDs7Ozs7T0FLRztJQUNILEdBQUcsQ0FBUSxHQUFnQixFQUFFLFdBQVcsR0FBRyxJQUFJLENBQUMsbUJBQW1CO1FBQ2xFLE9BQU8sV0FBVyxDQUFDLFVBQVUsRUFBRSxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsZ0JBQWdCLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDN0UsQ0FBQztJQUVEOzs7Ozs7T0FNRztJQUNILEdBQUcsQ0FDRixHQUFnQixFQUNoQixLQUFVLEVBQ1YsV0FBVyxHQUFHLElBQUksQ0FBQyxtQkFBbUI7UUFFdEMsT0FBTyxXQUFXLENBQUMsV0FBVyxFQUFFLENBQUMsS0FBSyxFQUFFLEVBQUU7WUFDekMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxLQUFLLEVBQUUsR0FBRyxDQUFDLENBQUM7WUFDdEIsT0FBTyxnQkFBZ0IsQ0FBQyxLQUFLLENBQUMsV0FBVyxDQUFDLENBQUM7UUFDNUMsQ0FBQyxDQUFDLENBQUM7SUFDSixDQUFDO0lBRUQ7Ozs7OztPQU1HO0lBQ0gsT0FBTyxDQUNOLE9BQTZCLEVBQzdCLFdBQVcsR0FBRyxJQUFJLENBQUMsbUJBQW1CO1FBRXRDLE9BQU8sV0FBVyxDQUFDLFdBQVcsRUFBRSxDQUFDLEtBQUssRUFBRSxFQUFFO1lBQ3pDLE9BQU8sQ0FBQyxPQUFPLENBQUMsQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDMUQsT0FBTyxnQkFBZ0IsQ0FBQyxLQUFLLENBQUMsV0FBVyxDQUFDLENBQUM7UUFDNUMsQ0FBQyxDQUFDLENBQUM7SUFDSixDQUFDO0lBRUQ7Ozs7O09BS0c7SUFDSCxPQUFPLENBQ04sSUFBbUIsRUFDbkIsV0FBVyxHQUFHLElBQUksQ0FBQyxtQkFBbUI7UUFFdEMsT0FBTyxXQUFXLENBQUMsVUFBVSxFQUFFLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FDeEMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxFQUFFLEVBQUUsQ0FBQyxnQkFBZ0IsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUNoRSxDQUFDO0lBQ0gsQ0FBQztJQUVEOzs7Ozs7T0FNRztJQUNILE1BQU0sQ0FDTCxHQUFnQixFQUNoQixPQUF1QyxFQUN2QyxXQUFXLEdBQUcsSUFBSSxDQUFDLG1CQUFtQjtRQUV0QyxPQUFPLFdBQVcsQ0FDakIsV0FBVyxFQUNYLENBQUMsS0FBSyxFQUFFLEVBQUU7UUFDVix1Q0FBdUM7UUFDdkMsaUVBQWlFO1FBQ2pFLHlDQUF5QztRQUN6QyxJQUFJLE9BQU8sQ0FBQyxDQUFDLE9BQU8sRUFBRSxNQUFNLEVBQUUsRUFBRTtZQUMvQixLQUFLLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLFNBQVMsR0FBRztnQkFDMUIsSUFBSSxDQUFDO29CQUNKLEtBQUssQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQztvQkFDckMsT0FBTyxDQUFDLGdCQUFnQixDQUFDLEtBQUssQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDO2dCQUM5QyxDQUFDO2dCQUFDLE9BQU8sR0FBRyxFQUFFLENBQUM7b0JBQ2QsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDO2dCQUNiLENBQUM7WUFDRixDQUFDLENBQUM7UUFDSCxDQUFDLENBQUMsQ0FDRixDQUFDO0lBQ0gsQ0FBQztJQUVEOzs7OztPQUtHO0lBQ0gsR0FBRyxDQUNGLEdBQWdCLEVBQ2hCLFdBQVcsR0FBRyxJQUFJLENBQUMsbUJBQW1CO1FBRXRDLE9BQU8sV0FBVyxDQUFDLFdBQVcsRUFBRSxDQUFDLEtBQUssRUFBRSxFQUFFO1lBQ3pDLEtBQUssQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUM7WUFDbEIsT0FBTyxnQkFBZ0IsQ0FBQyxLQUFLLENBQUMsV0FBVyxDQUFDLENBQUM7UUFDNUMsQ0FBQyxDQUFDLENBQUM7SUFDSixDQUFDO0lBRUQ7Ozs7T0FJRztJQUNILEtBQUssQ0FBQyxXQUFXLEdBQUcsSUFBSSxDQUFDLG1CQUFtQjtRQUMzQyxPQUFPLFdBQVcsQ0FBQyxXQUFXLEVBQUUsQ0FBQyxLQUFLLEVBQUUsRUFBRTtZQUN6QyxLQUFLLENBQUMsS0FBSyxFQUFFLENBQUM7WUFDZCxPQUFPLGdCQUFnQixDQUFDLEtBQUssQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUM1QyxDQUFDLENBQUMsQ0FBQztJQUNKLENBQUM7SUFFRCxVQUFVLENBQ1QsV0FBcUIsRUFDckIsUUFBOEM7UUFFOUMsT0FBTyxXQUFXLENBQUMsVUFBVSxFQUFFLENBQUMsS0FBSyxFQUFFLEVBQUU7WUFDeEMsOEVBQThFO1lBQzlFLCtDQUErQztZQUMvQyxJQUFJLEdBQUcsR0FBRyxLQUFLLENBQUMsVUFBVSxFQUFFLENBQUM7WUFDN0IsR0FBRyxDQUFDLFNBQVMsR0FBRztnQkFDZixpREFBaUQ7Z0JBQ2pELElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTTtvQkFDZixPQUFPO2dCQUNSLFFBQVEsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7Z0JBQ3RCLElBQUksQ0FBQyxNQUFNLENBQUMsUUFBUSxFQUFFLENBQUM7WUFDeEIsQ0FBQyxDQUFDO1lBQ0YsR0FBRyxDQUFDLE9BQU8sR0FBRyxVQUFTLENBQUM7Z0JBQ3ZCLE9BQU8sQ0FBQyxHQUFHLENBQUMsMEJBQTBCLEVBQUUsQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFBO1lBQ2pELENBQUMsQ0FBQTtZQUNELE9BQU8sZ0JBQWdCLENBQUMsS0FBSyxDQUFDLFdBQVcsQ0FBQyxDQUFDO1FBQzVDLENBQUMsQ0FBQyxDQUFDO0lBQ0osQ0FBQztJQUVEOzs7O09BSUc7SUFDSCxJQUFJLENBQUMsV0FBVyxHQUFHLElBQUksQ0FBQyxtQkFBbUI7UUFDMUMsTUFBTSxLQUFLLEdBQWtCLEVBQUUsQ0FBQztRQUVoQyxPQUFPLElBQUksQ0FBQyxVQUFVLENBQUMsV0FBVyxFQUFFLENBQUMsTUFBTSxFQUFFLEVBQUUsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FDM0UsR0FBRyxFQUFFLENBQUMsS0FBSyxDQUNYLENBQUM7SUFDSCxDQUFDO0lBRUQ7Ozs7T0FJRztJQUNILE1BQU0sQ0FBQyxXQUFXLEdBQUcsSUFBSSxDQUFDLG1CQUFtQjtRQUM1QyxNQUFNLEtBQUssR0FBVSxFQUFFLENBQUM7UUFFeEIsT0FBTyxJQUFJLENBQUMsVUFBVSxDQUFDLFdBQVcsRUFBRSxDQUFDLE1BQU0sRUFBRSxFQUFFLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQzdFLEdBQUcsRUFBRSxDQUFDLEtBQUssQ0FDWCxDQUFDO0lBQ0gsQ0FBQztJQUVEOzs7O09BSUc7SUFDSCxPQUFPLENBQUMsV0FBVyxHQUFHLElBQUksQ0FBQyxtQkFBbUI7UUFDN0MsTUFBTSxLQUFLLEdBQXlCLEVBQUUsQ0FBQztRQUV2QyxPQUFPLElBQUksQ0FBQyxVQUFVLENBQUMsV0FBVyxFQUFFLENBQUMsTUFBTSxFQUFFLEVBQUUsQ0FDOUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxHQUFHLEVBQUUsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQ3RDLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDLEtBQUssQ0FBQyxDQUFDO0lBQ3JCLENBQUM7O0FBOU1GLGtCQStNQztBQTdNTyxVQUFNLEdBQXVCLEVBQUUsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IHZlcnNpb24gfSBmcm9tIFwib3NcIjtcblxuZXhwb3J0IGZ1bmN0aW9uIHByb21pc2lmeVJlcXVlc3QgPCBUID0gdW5kZWZpbmVkID4gKFxuXHRyZXF1ZXN0OiBJREJSZXF1ZXN0IDwgVCA+IHwgSURCVHJhbnNhY3Rpb24sXG4pOiBQcm9taXNlIDwgVCA+IHtcblx0cmV0dXJuIG5ldyBQcm9taXNlIDwgVCA+ICgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG5cdFx0Ly8gQHRzLWlnbm9yZSAtIGZpbGUgc2l6ZSBoYWNrc1xuXHRcdHJlcXVlc3Qub25jb21wbGV0ZSA9IHJlcXVlc3Qub25zdWNjZXNzID0gKCkgPT4gcmVzb2x2ZShyZXF1ZXN0LnJlc3VsdCk7XG5cdFx0Ly8gQHRzLWlnbm9yZSAtIGZpbGUgc2l6ZSBoYWNrc1xuXHRcdHJlcXVlc3Qub25hYm9ydCA9IHJlcXVlc3Qub25lcnJvciA9ICgpID0+IHJlamVjdChyZXF1ZXN0LmVycm9yKTtcblx0fSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVTdG9yZShkYk5hbWU6IHN0cmluZywgc3RvcmVOYW1lczogc3RyaW5nW10sIHZlcnNpb246bnVtYmVyKTogQ3JlYXRlU3RvcmVSZXN1bHQge1xuXHQvL2NvbnNvbGUubG9nKFwiY3JlYXRlU3RvcmVcIiwgZGJOYW1lLCBzdG9yZU5hbWVzLCB2ZXJzaW9uKVxuXHRjb25zdCByZXF1ZXN0ID0gaW5kZXhlZERCLm9wZW4oZGJOYW1lLCB2ZXJzaW9uKTtcblx0cmVxdWVzdC5vbnVwZ3JhZGVuZWVkZWQgPSAoKSA9PiB7XG5cdFx0Y29uc3QgZGIgPSByZXF1ZXN0LnJlc3VsdDtcblx0XHRsZXQgbGlzdCA9IGRiLm9iamVjdFN0b3JlTmFtZXM7XG5cdFx0c3RvcmVOYW1lcy5mb3JFYWNoKHN0b3JlTmFtZT0+e1xuXHRcdFx0Y29uc29sZS5sb2coXCJjcmVhdGVTdG9yZVwiLCBzdG9yZU5hbWUsIGxpc3QuY29udGFpbnMoc3RvcmVOYW1lKSwgbGlzdClcblx0XHRcdGlmKCFsaXN0LmNvbnRhaW5zKHN0b3JlTmFtZSkpe1xuXHRcdFx0XHRsZXQgcmVzdWx0ID0gZGIuY3JlYXRlT2JqZWN0U3RvcmUoc3RvcmVOYW1lKVxuXHRcdFx0XHRjb25zb2xlLmxvZyhcImRiLmNyZWF0ZU9iamVjdFN0b3JlOlwiLCByZXN1bHQpXG5cdFx0XHR9XG5cdFx0fSlcblx0fTtcblxuXHRjb25zdCBkYnAgPSBwcm9taXNpZnlSZXF1ZXN0KHJlcXVlc3QpO1xuXG5cdHJldHVybiB7XG5cdFx0ZGJOYW1lLFxuXHRcdGdldFVzZVN0b3JlKHN0b3JlTmFtZTpzdHJpbmcpe1xuXHRcdFx0cmV0dXJuIDxUPih0eE1vZGU6SURCVHJhbnNhY3Rpb25Nb2RlLCBjYWxsYmFjazpDYWxsYmFjazxUPik9PmRicC50aGVuKChkYikgPT5cblx0XHRcdFx0Y2FsbGJhY2soZGIudHJhbnNhY3Rpb24oc3RvcmVOYW1lLCB0eE1vZGUpLm9iamVjdFN0b3JlKHN0b3JlTmFtZSkpLFxuXHRcdFx0KVxuXHRcdH1cblx0IH1cbn1cblxuZXhwb3J0IHR5cGUgQ2FsbGJhY2s8VD4gPSAoc3RvcmU6IElEQk9iamVjdFN0b3JlKSA9PiBUIHwgUHJvbWlzZUxpa2UgPCBUID47XG5cbmV4cG9ydCB0eXBlIENyZWF0ZVN0b3JlUmVzdWx0ID0ge1xuXHRkYk5hbWU6c3RyaW5nLFxuXHRnZXRVc2VTdG9yZShzdG9yZU5hbWU6IHN0cmluZyk6VXNlU3RvcmVcbn1cblxuZXhwb3J0IHR5cGUgVXNlU3RvcmUgPSA8IFQgPiAoXG5cdHR4TW9kZTogSURCVHJhbnNhY3Rpb25Nb2RlLFxuXHRjYWxsYmFjazogKHN0b3JlOiBJREJPYmplY3RTdG9yZSkgPT4gVCB8IFByb21pc2VMaWtlIDwgVCA+ICxcbikgPT4gUHJvbWlzZSA8IFQgPiA7XG5cblxuXG5leHBvcnQgY2xhc3MgaURCe1xuXG5cdHN0YXRpYyBzdG9yZXM6Q3JlYXRlU3RvcmVSZXN1bHRbXSA9IFtdO1xuXG5cdHN0YXRpYyBnZXRPckNyZWF0ZVN0b3JlKHN0b3JlTmFtZTpzdHJpbmcsIGRiTmFtZTpzdHJpbmcsIHZlcnNpb246bnVtYmVyKTpVc2VTdG9yZXtcblx0XHRsZXQgc3RvcmUgPSB0aGlzLnN0b3Jlcy5maW5kKHM9PnMuZGJOYW1lID09IGRiTmFtZSk7XG5cdFx0aWYoc3RvcmUpXG5cdFx0XHRyZXR1cm4gc3RvcmUuZ2V0VXNlU3RvcmUoc3RvcmVOYW1lKTtcblx0XHRyZXR1cm4gY3JlYXRlU3RvcmUoZGJOYW1lLCBbc3RvcmVOYW1lXSwgdmVyc2lvbikuZ2V0VXNlU3RvcmUoc3RvcmVOYW1lKTtcblx0fVxuXG5cdHN0YXRpYyBidWlsZERCKGRiTmFtZTpzdHJpbmcsIHZlcnNpb249MSwgc3RvcmVOYW1lcz1bXCJ0eFwiLCBcImNhY2hlXCJdKXtcblx0XHRsZXQgc3RvcmUgPSB0aGlzLnN0b3Jlcy5maW5kKHM9PnMuZGJOYW1lID09IGRiTmFtZSk7XG5cdFx0Ly9jb25zb2xlLmxvZyhcImlEQi5idWlsZERCIC0gQVwiLCBkYk5hbWUsIHZlcnNpb24sIHN0b3JlTmFtZXMpXG5cdFx0aWYoIXN0b3JlKXtcblx0XHRcdC8vY29uc29sZS5sb2coXCJpREIuYnVpbGREQiAtIEJcIiwgc3RvcmVOYW1lcylcblx0XHRcdHRoaXMuc3RvcmVzLnB1c2goY3JlYXRlU3RvcmUoZGJOYW1lLCBzdG9yZU5hbWVzLCB2ZXJzaW9uKSlcblx0XHR9XG5cdH1cblxuXHRkZWZhdWx0R2V0U3RvcmVGdW5jOiBVc2VTdG9yZTtcblx0Y29uc3RydWN0b3Iob3B0aW9uczp7c3RvcmVOYW1lOnN0cmluZywgZGJOYW1lOnN0cmluZ30pe1xuXHRcdGxldCB7c3RvcmVOYW1lLCBkYk5hbWV9ID0gb3B0aW9ucztcblx0XHRjb25zdCB2ZXJzaW9uID0gNDtcblx0XHRpREIuYnVpbGREQihkYk5hbWUsIHZlcnNpb24pO1xuXHRcdHRoaXMuZGVmYXVsdEdldFN0b3JlRnVuYyA9IGlEQi5nZXRPckNyZWF0ZVN0b3JlKHN0b3JlTmFtZSwgZGJOYW1lLCB2ZXJzaW9uKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBHZXQgYSB2YWx1ZSBieSBpdHMga2V5LlxuXHQgKlxuXHQgKiBAcGFyYW0ga2V5XG5cdCAqIEBwYXJhbSBjdXN0b21TdG9yZSBNZXRob2QgdG8gZ2V0IGEgY3VzdG9tIHN0b3JlLiBVc2Ugd2l0aCBjYXV0aW9uIChzZWUgdGhlIGRvY3MpLlxuXHQgKi9cblx0Z2V0PFQ9YW55PihrZXk6IElEQlZhbGlkS2V5LCBjdXN0b21TdG9yZSA9IHRoaXMuZGVmYXVsdEdldFN0b3JlRnVuYyk6IFByb21pc2UgPCBUIHwgdW5kZWZpbmVkID4ge1xuXHRcdHJldHVybiBjdXN0b21TdG9yZSgncmVhZG9ubHknLCAoc3RvcmUpID0+IHByb21pc2lmeVJlcXVlc3Qoc3RvcmUuZ2V0KGtleSkpKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBTZXQgYSB2YWx1ZSB3aXRoIGEga2V5LlxuXHQgKlxuXHQgKiBAcGFyYW0ga2V5XG5cdCAqIEBwYXJhbSB2YWx1ZVxuXHQgKiBAcGFyYW0gY3VzdG9tU3RvcmUgTWV0aG9kIHRvIGdldCBhIGN1c3RvbSBzdG9yZS4gVXNlIHdpdGggY2F1dGlvbiAoc2VlIHRoZSBkb2NzKS5cblx0ICovXG5cdHNldChcblx0XHRrZXk6IElEQlZhbGlkS2V5LFxuXHRcdHZhbHVlOiBhbnksXG5cdFx0Y3VzdG9tU3RvcmUgPSB0aGlzLmRlZmF1bHRHZXRTdG9yZUZ1bmNcblx0KTogUHJvbWlzZSA8IHZvaWQgPiB7XG5cdFx0cmV0dXJuIGN1c3RvbVN0b3JlKCdyZWFkd3JpdGUnLCAoc3RvcmUpID0+IHtcblx0XHRcdHN0b3JlLnB1dCh2YWx1ZSwga2V5KTtcblx0XHRcdHJldHVybiBwcm9taXNpZnlSZXF1ZXN0KHN0b3JlLnRyYW5zYWN0aW9uKTtcblx0XHR9KTtcblx0fVxuXG5cdC8qKlxuXHQgKiBTZXQgbXVsdGlwbGUgdmFsdWVzIGF0IG9uY2UuIFRoaXMgaXMgZmFzdGVyIHRoYW4gY2FsbGluZyBzZXQoKSBtdWx0aXBsZSB0aW1lcy5cblx0ICogSXQncyBhbHNvIGF0b21pYyDigJMgaWYgb25lIG9mIHRoZSBwYWlycyBjYW4ndCBiZSBhZGRlZCwgbm9uZSB3aWxsIGJlIGFkZGVkLlxuXHQgKlxuXHQgKiBAcGFyYW0gZW50cmllcyBBcnJheSBvZiBlbnRyaWVzLCB3aGVyZSBlYWNoIGVudHJ5IGlzIGFuIGFycmF5IG9mIGBba2V5LCB2YWx1ZV1gLlxuXHQgKiBAcGFyYW0gY3VzdG9tU3RvcmUgTWV0aG9kIHRvIGdldCBhIGN1c3RvbSBzdG9yZS4gVXNlIHdpdGggY2F1dGlvbiAoc2VlIHRoZSBkb2NzKS5cblx0ICovXG5cdHNldE1hbnkoXG5cdFx0ZW50cmllczogW0lEQlZhbGlkS2V5LCBhbnldW10sXG5cdFx0Y3VzdG9tU3RvcmUgPSB0aGlzLmRlZmF1bHRHZXRTdG9yZUZ1bmMsXG5cdCk6IFByb21pc2UgPCB2b2lkID4ge1xuXHRcdHJldHVybiBjdXN0b21TdG9yZSgncmVhZHdyaXRlJywgKHN0b3JlKSA9PiB7XG5cdFx0XHRlbnRyaWVzLmZvckVhY2goKGVudHJ5KSA9PiBzdG9yZS5wdXQoZW50cnlbMV0sIGVudHJ5WzBdKSk7XG5cdFx0XHRyZXR1cm4gcHJvbWlzaWZ5UmVxdWVzdChzdG9yZS50cmFuc2FjdGlvbik7XG5cdFx0fSk7XG5cdH1cblxuXHQvKipcblx0ICogR2V0IG11bHRpcGxlIHZhbHVlcyBieSB0aGVpciBrZXlzXG5cdCAqXG5cdCAqIEBwYXJhbSBrZXlzXG5cdCAqIEBwYXJhbSBjdXN0b21TdG9yZSBNZXRob2QgdG8gZ2V0IGEgY3VzdG9tIHN0b3JlLiBVc2Ugd2l0aCBjYXV0aW9uIChzZWUgdGhlIGRvY3MpLlxuXHQgKi9cblx0Z2V0TWFueShcblx0XHRrZXlzOiBJREJWYWxpZEtleVtdLFxuXHRcdGN1c3RvbVN0b3JlID0gdGhpcy5kZWZhdWx0R2V0U3RvcmVGdW5jLFxuXHQpOiBQcm9taXNlIDwgYW55W10gPiB7XG5cdFx0cmV0dXJuIGN1c3RvbVN0b3JlKCdyZWFkb25seScsIChzdG9yZSkgPT5cblx0XHRcdFByb21pc2UuYWxsKGtleXMubWFwKChrZXkpID0+IHByb21pc2lmeVJlcXVlc3Qoc3RvcmUuZ2V0KGtleSkpKSksXG5cdFx0KTtcblx0fVxuXG5cdC8qKlxuXHQgKiBVcGRhdGUgYSB2YWx1ZS4gVGhpcyBsZXRzIHlvdSBzZWUgdGhlIG9sZCB2YWx1ZSBhbmQgdXBkYXRlIGl0IGFzIGFuIGF0b21pYyBvcGVyYXRpb24uXG5cdCAqXG5cdCAqIEBwYXJhbSBrZXlcblx0ICogQHBhcmFtIHVwZGF0ZXIgQSBjYWxsYmFjayB0aGF0IHRha2VzIHRoZSBvbGQgdmFsdWUgYW5kIHJldHVybnMgYSBuZXcgdmFsdWUuXG5cdCAqIEBwYXJhbSBjdXN0b21TdG9yZSBNZXRob2QgdG8gZ2V0IGEgY3VzdG9tIHN0b3JlLiBVc2Ugd2l0aCBjYXV0aW9uIChzZWUgdGhlIGRvY3MpLlxuXHQgKi9cblx0dXBkYXRlIDwgVCA9IGFueSA+IChcblx0XHRrZXk6IElEQlZhbGlkS2V5LFxuXHRcdHVwZGF0ZXI6IChvbGRWYWx1ZTogVCB8IHVuZGVmaW5lZCkgPT4gVCxcblx0XHRjdXN0b21TdG9yZSA9IHRoaXMuZGVmYXVsdEdldFN0b3JlRnVuYyxcblx0KTogUHJvbWlzZSA8IHZvaWQgPiB7XG5cdFx0cmV0dXJuIGN1c3RvbVN0b3JlKFxuXHRcdFx0J3JlYWR3cml0ZScsXG5cdFx0XHQoc3RvcmUpID0+XG5cdFx0XHQvLyBOZWVkIHRvIGNyZWF0ZSB0aGUgcHJvbWlzZSBtYW51YWxseS5cblx0XHRcdC8vIElmIEkgdHJ5IHRvIGNoYWluIHByb21pc2VzLCB0aGUgdHJhbnNhY3Rpb24gY2xvc2VzIGluIGJyb3dzZXJzXG5cdFx0XHQvLyB0aGF0IHVzZSBhIHByb21pc2UgcG9seWZpbGwgKElFMTAvMTEpLlxuXHRcdFx0bmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuXHRcdFx0XHRzdG9yZS5nZXQoa2V5KS5vbnN1Y2Nlc3MgPSBmdW5jdGlvbigpIHtcblx0XHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdFx0c3RvcmUucHV0KHVwZGF0ZXIodGhpcy5yZXN1bHQpLCBrZXkpO1xuXHRcdFx0XHRcdFx0cmVzb2x2ZShwcm9taXNpZnlSZXF1ZXN0KHN0b3JlLnRyYW5zYWN0aW9uKSk7XG5cdFx0XHRcdFx0fSBjYXRjaCAoZXJyKSB7XG5cdFx0XHRcdFx0XHRyZWplY3QoZXJyKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH07XG5cdFx0XHR9KSxcblx0XHQpO1xuXHR9XG5cblx0LyoqXG5cdCAqIERlbGV0ZSBhIHBhcnRpY3VsYXIga2V5IGZyb20gdGhlIHN0b3JlLlxuXHQgKlxuXHQgKiBAcGFyYW0ga2V5XG5cdCAqIEBwYXJhbSBjdXN0b21TdG9yZSBNZXRob2QgdG8gZ2V0IGEgY3VzdG9tIHN0b3JlLiBVc2Ugd2l0aCBjYXV0aW9uIChzZWUgdGhlIGRvY3MpLlxuXHQgKi9cblx0ZGVsKFxuXHRcdGtleTogSURCVmFsaWRLZXksXG5cdFx0Y3VzdG9tU3RvcmUgPSB0aGlzLmRlZmF1bHRHZXRTdG9yZUZ1bmMsXG5cdCk6IFByb21pc2UgPCB2b2lkID4ge1xuXHRcdHJldHVybiBjdXN0b21TdG9yZSgncmVhZHdyaXRlJywgKHN0b3JlKSA9PiB7XG5cdFx0XHRzdG9yZS5kZWxldGUoa2V5KTtcblx0XHRcdHJldHVybiBwcm9taXNpZnlSZXF1ZXN0KHN0b3JlLnRyYW5zYWN0aW9uKTtcblx0XHR9KTtcblx0fVxuXG5cdC8qKlxuXHQgKiBDbGVhciBhbGwgdmFsdWVzIGluIHRoZSBzdG9yZS5cblx0ICpcblx0ICogQHBhcmFtIGN1c3RvbVN0b3JlIE1ldGhvZCB0byBnZXQgYSBjdXN0b20gc3RvcmUuIFVzZSB3aXRoIGNhdXRpb24gKHNlZSB0aGUgZG9jcykuXG5cdCAqL1xuXHRjbGVhcihjdXN0b21TdG9yZSA9IHRoaXMuZGVmYXVsdEdldFN0b3JlRnVuYyk6IFByb21pc2UgPCB2b2lkID4ge1xuXHRcdHJldHVybiBjdXN0b21TdG9yZSgncmVhZHdyaXRlJywgKHN0b3JlKSA9PiB7XG5cdFx0XHRzdG9yZS5jbGVhcigpO1xuXHRcdFx0cmV0dXJuIHByb21pc2lmeVJlcXVlc3Qoc3RvcmUudHJhbnNhY3Rpb24pO1xuXHRcdH0pO1xuXHR9XG5cblx0ZWFjaEN1cnNvcihcblx0XHRjdXN0b21TdG9yZTogVXNlU3RvcmUsXG5cdFx0Y2FsbGJhY2s6IChjdXJzb3I6IElEQkN1cnNvcldpdGhWYWx1ZSkgPT4gdm9pZCxcblx0KTogUHJvbWlzZSA8IHZvaWQgPiB7XG5cdFx0cmV0dXJuIGN1c3RvbVN0b3JlKCdyZWFkb25seScsIChzdG9yZSkgPT4ge1xuXHRcdFx0Ly8gVGhpcyB3b3VsZCBiZSBzdG9yZS5nZXRBbGxLZXlzKCksIGJ1dCBpdCBpc24ndCBzdXBwb3J0ZWQgYnkgRWRnZSBvciBTYWZhcmkuXG5cdFx0XHQvLyBBbmQgb3BlbktleUN1cnNvciBpc24ndCBzdXBwb3J0ZWQgYnkgU2FmYXJpLlxuXHRcdFx0bGV0IHJlcSA9IHN0b3JlLm9wZW5DdXJzb3IoKTtcblx0XHRcdHJlcS5vbnN1Y2Nlc3MgPSBmdW5jdGlvbigpIHtcblx0XHRcdFx0Ly9jb25zb2xlLmxvZyhcInN0b3JlLm9wZW5DdXJzb3Iub25zdWNjZXNzXCIsIHRoaXMpXG5cdFx0XHRcdGlmICghdGhpcy5yZXN1bHQpXG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRjYWxsYmFjayh0aGlzLnJlc3VsdCk7XG5cdFx0XHRcdHRoaXMucmVzdWx0LmNvbnRpbnVlKCk7XG5cdFx0XHR9O1xuXHRcdFx0cmVxLm9uZXJyb3IgPSBmdW5jdGlvbihlKSB7XG5cdFx0XHRcdGNvbnNvbGUubG9nKFwic3RvcmUub3BlbkN1cnNvci5vbmVycm9yXCIsIGUsIHRoaXMpXG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gcHJvbWlzaWZ5UmVxdWVzdChzdG9yZS50cmFuc2FjdGlvbik7XG5cdFx0fSk7XG5cdH1cblxuXHQvKipcblx0ICogR2V0IGFsbCBrZXlzIGluIHRoZSBzdG9yZS5cblx0ICpcblx0ICogQHBhcmFtIGN1c3RvbVN0b3JlIE1ldGhvZCB0byBnZXQgYSBjdXN0b20gc3RvcmUuIFVzZSB3aXRoIGNhdXRpb24gKHNlZSB0aGUgZG9jcykuXG5cdCAqL1xuXHRrZXlzKGN1c3RvbVN0b3JlID0gdGhpcy5kZWZhdWx0R2V0U3RvcmVGdW5jKTogUHJvbWlzZSA8IElEQlZhbGlkS2V5W10gPiB7XG5cdFx0Y29uc3QgaXRlbXM6IElEQlZhbGlkS2V5W10gPSBbXTtcblxuXHRcdHJldHVybiB0aGlzLmVhY2hDdXJzb3IoY3VzdG9tU3RvcmUsIChjdXJzb3IpID0+IGl0ZW1zLnB1c2goY3Vyc29yLmtleSkpLnRoZW4oXG5cdFx0XHQoKSA9PiBpdGVtcyxcblx0XHQpO1xuXHR9XG5cblx0LyoqXG5cdCAqIEdldCBhbGwgdmFsdWVzIGluIHRoZSBzdG9yZS5cblx0ICpcblx0ICogQHBhcmFtIGN1c3RvbVN0b3JlIE1ldGhvZCB0byBnZXQgYSBjdXN0b20gc3RvcmUuIFVzZSB3aXRoIGNhdXRpb24gKHNlZSB0aGUgZG9jcykuXG5cdCAqL1xuXHR2YWx1ZXMoY3VzdG9tU3RvcmUgPSB0aGlzLmRlZmF1bHRHZXRTdG9yZUZ1bmMpOiBQcm9taXNlIDwgSURCVmFsaWRLZXlbXSA+IHtcblx0XHRjb25zdCBpdGVtczogYW55W10gPSBbXTtcblxuXHRcdHJldHVybiB0aGlzLmVhY2hDdXJzb3IoY3VzdG9tU3RvcmUsIChjdXJzb3IpID0+IGl0ZW1zLnB1c2goY3Vyc29yLnZhbHVlKSkudGhlbihcblx0XHRcdCgpID0+IGl0ZW1zLFxuXHRcdCk7XG5cdH1cblxuXHQvKipcblx0ICogR2V0IGFsbCBlbnRyaWVzIGluIHRoZSBzdG9yZS4gRWFjaCBlbnRyeSBpcyBhbiBhcnJheSBvZiBgW2tleSwgdmFsdWVdYC5cblx0ICpcblx0ICogQHBhcmFtIGN1c3RvbVN0b3JlIE1ldGhvZCB0byBnZXQgYSBjdXN0b20gc3RvcmUuIFVzZSB3aXRoIGNhdXRpb24gKHNlZSB0aGUgZG9jcykuXG5cdCAqL1xuXHRlbnRyaWVzKGN1c3RvbVN0b3JlID0gdGhpcy5kZWZhdWx0R2V0U3RvcmVGdW5jKTogUHJvbWlzZSA8IFtJREJWYWxpZEtleSwgYW55XVtdID4ge1xuXHRcdGNvbnN0IGl0ZW1zOiBbSURCVmFsaWRLZXksIGFueV1bXSA9IFtdO1xuXG5cdFx0cmV0dXJuIHRoaXMuZWFjaEN1cnNvcihjdXN0b21TdG9yZSwgKGN1cnNvcikgPT5cblx0XHRcdGl0ZW1zLnB1c2goW2N1cnNvci5rZXksIGN1cnNvci52YWx1ZV0pLFxuXHRcdCkudGhlbigoKSA9PiBpdGVtcyk7XG5cdH1cbn0iXX0=