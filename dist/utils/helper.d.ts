import { Decimal } from 'decimal.js';
export { Decimal };
export declare const sha256: (str: string) => string;
export declare const KAS: (v: number) => string;
export declare const now: () => number;
export declare const UID: (join?: string) => string;
export declare const dpc: (delay: number | Function, fn?: Function | number) => number;
export interface DeferredPromise extends Promise<any> {
    resolve(data?: any): void;
    reject(error?: any): void;
}
export declare const Deferred: () => DeferredPromise;
export declare const createHash: (str: string) => string;
export declare const throttle: (func: Function, wait: number, options?: {
    leading?: boolean;
    trailing?: boolean;
}) => () => any;
export declare const chunks: (list: any[], size: number) => (any[])[];
//# sourceMappingURL=helper.d.ts.map