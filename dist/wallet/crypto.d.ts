export declare class Crypto {
    static encrypt(passphrase: string, data: string): Promise<string>;
    static decrypt(passphrase: string, data: string): Promise<string>;
    static createKey(passphrase: string, saltStr?: string): {
        key: string;
        salt: string;
    };
    static parseHexCode(hexCode: string): string[];
    static toHexCode(data: string[]): string;
}
//# sourceMappingURL=crypto.d.ts.map