export declare function promisifyRequest<T = undefined>(request: IDBRequest<T> | IDBTransaction): Promise<T>;
export declare function createStore(dbName: string, storeNames: string[], version: number): CreateStoreResult;
export type Callback<T> = (store: IDBObjectStore) => T | PromiseLike<T>;
export type CreateStoreResult = {
    dbName: string;
    getUseStore(storeName: string): UseStore;
};
export type UseStore = <T>(txMode: IDBTransactionMode, callback: (store: IDBObjectStore) => T | PromiseLike<T>) => Promise<T>;
export declare class iDB {
    static stores: CreateStoreResult[];
    static getOrCreateStore(storeName: string, dbName: string, version: number): UseStore;
    static buildDB(dbName: string, version?: number, storeNames?: string[]): void;
    defaultGetStoreFunc: UseStore;
    constructor(options: {
        storeName: string;
        dbName: string;
    });
    /**
     * Get a value by its key.
     *
     * @param key
     * @param customStore Method to get a custom store. Use with caution (see the docs).
     */
    get<T = any>(key: IDBValidKey, customStore?: UseStore): Promise<T | undefined>;
    /**
     * Set a value with a key.
     *
     * @param key
     * @param value
     * @param customStore Method to get a custom store. Use with caution (see the docs).
     */
    set(key: IDBValidKey, value: any, customStore?: UseStore): Promise<void>;
    /**
     * Set multiple values at once. This is faster than calling set() multiple times.
     * It's also atomic – if one of the pairs can't be added, none will be added.
     *
     * @param entries Array of entries, where each entry is an array of `[key, value]`.
     * @param customStore Method to get a custom store. Use with caution (see the docs).
     */
    setMany(entries: [IDBValidKey, any][], customStore?: UseStore): Promise<void>;
    /**
     * Get multiple values by their keys
     *
     * @param keys
     * @param customStore Method to get a custom store. Use with caution (see the docs).
     */
    getMany(keys: IDBValidKey[], customStore?: UseStore): Promise<any[]>;
    /**
     * Update a value. This lets you see the old value and update it as an atomic operation.
     *
     * @param key
     * @param updater A callback that takes the old value and returns a new value.
     * @param customStore Method to get a custom store. Use with caution (see the docs).
     */
    update<T = any>(key: IDBValidKey, updater: (oldValue: T | undefined) => T, customStore?: UseStore): Promise<void>;
    /**
     * Delete a particular key from the store.
     *
     * @param key
     * @param customStore Method to get a custom store. Use with caution (see the docs).
     */
    del(key: IDBValidKey, customStore?: UseStore): Promise<void>;
    /**
     * Clear all values in the store.
     *
     * @param customStore Method to get a custom store. Use with caution (see the docs).
     */
    clear(customStore?: UseStore): Promise<void>;
    eachCursor(customStore: UseStore, callback: (cursor: IDBCursorWithValue) => void): Promise<void>;
    /**
     * Get all keys in the store.
     *
     * @param customStore Method to get a custom store. Use with caution (see the docs).
     */
    keys(customStore?: UseStore): Promise<IDBValidKey[]>;
    /**
     * Get all values in the store.
     *
     * @param customStore Method to get a custom store. Use with caution (see the docs).
     */
    values(customStore?: UseStore): Promise<IDBValidKey[]>;
    /**
     * Get all entries in the store. Each entry is an array of `[key, value]`.
     *
     * @param customStore Method to get a custom store. Use with caution (see the docs).
     */
    entries(customStore?: UseStore): Promise<[IDBValidKey, any][]>;
}
//# sourceMappingURL=indexed-db.d.ts.map