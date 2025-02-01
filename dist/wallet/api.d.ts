import { Api, IRPC, RPC } from 'custom-types';
import { EventTargetImpl, EventListener } from './event-target-impl';
export declare class ApiError {
    name: string;
    message: string;
    stack: any;
    debugInfo: any;
    extraDebugInfo: any;
    constructor(message: string, debugInfo?: any);
    setDebugInfo(info: any): void;
    setExtraDebugInfo(info: any): void;
}
declare class KaspaAPI extends EventTargetImpl {
    rpc?: IRPC;
    isConnected: boolean;
    _utxosChangedSubUid: string | undefined;
    setRPC(rpc: IRPC): void;
    getRPC(): IRPC;
    on(type: string, callback: EventListener): void;
    _setConnected(isConnected: boolean): void;
    buildUtxoMap(entries: RPC.UTXOsByAddressesEntry[]): Map<string, Api.Utxo[]>;
    buildOutpointMap(outpoints: {
        address: string;
        outpoint: RPC.Outpoint;
    }[]): Map<string, RPC.Outpoint[]>;
    getVirtualSelectedParentBlueScore(): Promise<{
        blueScore: number;
    }>;
    getVirtualDaaScore(): Promise<{
        virtualDaaScore: number;
    }>;
    subscribeVirtualSelectedParentBlueScoreChanged(callback: RPC.callback<RPC.VirtualSelectedParentBlueScoreChangedNotification>): Promise<RPC.NotifyVirtualSelectedParentBlueScoreChangedResponse>;
    subscribeVirtualDaaScoreChanged(callback: RPC.callback<RPC.VirtualDaaScoreChangedNotification>): Promise<RPC.NotifyVirtualDaaScoreChangedResponse>;
    subscribeUtxosChanged(addresses: string[], callback: (added: Map<string, Api.Utxo[]>, removed: Map<string, RPC.Outpoint[]>) => void): Promise<RPC.NotifyUtxosChangedResponse>;
    getUtxosByAddresses(addresses: string[]): Promise<Map<string, Api.Utxo[]>>;
    submitTransaction(tx: RPC.SubmitTransactionRequest): Promise<string>;
    getBlock(blockHash: string): Promise<Api.BlockResponse>;
    getTransactionsByAddresses(addresses: string[], startingBlockHash?: string): Promise<Api.TransactionsByAddressesResponse>;
}
export { KaspaAPI };
//# sourceMappingURL=api.d.ts.map