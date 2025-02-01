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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddressManager = void 0;
// @ts-ignore
const kaspacore = __importStar(require("@kaspa/core-lib"));
// @ts-ignore
const secp256k1 = kaspacore.secp256k1; //require('secp256k1-wasm');
const event_target_impl_1 = require("./event-target-impl");
const helper_1 = require("../utils/helper");
class AddressManager extends event_target_impl_1.EventTargetImpl {
    constructor(HDWallet, network) {
        super();
        /**
         * Derives a new receive address. Sets related instance properties.
         */
        this.receiveAddress = {
            counter: 0,
            // @ts-ignore
            current: {},
            keypairs: {},
            atIndex: {},
            next: () => {
                const { address, privateKey } = this.deriveAddress('receive', this.receiveAddress.counter);
                this.receiveAddress.current = {
                    address,
                    privateKey
                };
                this.receiveAddress.keypairs[address] = privateKey;
                this.receiveAddress.atIndex[this.receiveAddress.counter] = address;
                this.receiveAddress.counter += 1;
                return address;
            },
            advance(n) {
                if (n > -1)
                    this.counter = n;
                this.next();
            },
        };
        /**
         * Derives a new change address. Sets related instance properties.
         */
        this.changeAddress = {
            counter: 0,
            // @ts-ignore
            current: {},
            keypairs: {},
            atIndex: {},
            next: () => {
                const { address, privateKey } = this.deriveAddress('change', this.changeAddress.counter);
                this.changeAddress.keypairs[address] = privateKey;
                this.changeAddress.current = {
                    address,
                    privateKey
                };
                this.changeAddress.atIndex[this.changeAddress.counter] = address;
                this.changeAddress.counter += 1;
                return address;
            },
            advance(n) {
                if (n > -1)
                    this.counter = n;
                // no call to next() here; composeTx calls it on demand.
            },
            reverse() {
                if (this.counter > 0)
                    this.counter -= 1;
            },
        };
        this.HDWallet = HDWallet;
        this.network = network;
    }
    get all() {
        return Object.assign(Object.assign({}, this.receiveAddress.keypairs), this.changeAddress.keypairs);
    }
    get shouldFetch() {
        const receive = Object.entries(this.receiveAddress.atIndex)
            .filter((record) => parseInt(record[0], 10) <= this.receiveAddress.counter - 1)
            .map((record) => record[1]);
        const change = Object.entries(this.changeAddress.atIndex)
            .filter((record) => parseInt(record[0], 10) <= this.changeAddress.counter)
            .map((record) => record[1]);
        return [...receive, ...change];
    }
    deriveAddress(deriveType, index) {
        //let ts0 = Date.now();
        const dType = deriveType === 'receive' ? 0 : 1;
        const { privateKey } = this.HDWallet.deriveChild(`m/44'/972/0'/${dType}'/${index}'`);
        //let ts1 = Date.now();
        //let publicKeys = secp256k1.export_public_keys(privateKey.toString());
        const xonlyPubKey = secp256k1.export_public_key_xonly(privateKey.toString());
        //let ts2 = Date.now();
        //console.log('durations:',(ts2-ts1)/1000,(ts1-ts0)/1000);
        //let address1 = new kaspacore.PublicKey(publicKeys.pubkey, {network:this.network}).toAddress().toString();
        //let address = privateKey.toAddress(this.network).toString();
        //let pubkey = Buffer.from(publicKeys.pubkey, "hex");
        //let {address:address3} = bitcoin.payments.p2pkh({pubkey});
        let xonly = Buffer.from(xonlyPubKey, "hex");
        //@ts-ignore
        let address = kaspacore.Address.fromPublicKeyBuffer(xonly, this.network).toString();
        /*
        console.log("privateKey:xxxx:", {
          privateKey: privateKey.toString(),
          address,
          address1,
          address2,
          "address1==address":address1==address,
          publicKeys
         });//, publicKeys)
         */
        //console.log("xonly:address2", "privateKey:"+privateKey.toString(), "address:"+address2)
        //console.log("xonly", publicKeys.xonly)
        (0, helper_1.dpc)(() => {
            this.emit("new-address", {
                type: deriveType,
                address,
                index
            });
        });
        return {
            address,
            privateKey
        };
    }
    /**
     * Derives n addresses and adds their keypairs to their deriveType-respective address object
     * @param n How many addresses to derive
     * @param deriveType receive or change address
     * @param offset Index to start at in derive path
     */
    getAddresses(n, deriveType, offset = 0) {
        return [...Array(n).keys()].map((i) => {
            const index = i + offset;
            const { address, privateKey } = this.deriveAddress(deriveType, index);
            if (deriveType === 'receive') {
                this.receiveAddress.atIndex[index] = address;
                this.receiveAddress.keypairs[address] = privateKey;
            }
            else {
                this.changeAddress.atIndex[index] = address;
                this.changeAddress.keypairs[address] = privateKey;
            }
            return {
                index,
                address,
                privateKey,
            };
        });
    }
    isOur(address) {
        return !!(this.changeAddress.keypairs[address] || this.receiveAddress.keypairs[address]);
    }
    isOurChange(address) {
        return !!this.changeAddress.keypairs[address];
    }
}
exports.AddressManager = AddressManager;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWRkcmVzcy1tYW5hZ2VyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vd2FsbGV0L2FkZHJlc3MtbWFuYWdlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSxhQUFhO0FBQ2IsMkRBQTZDO0FBRzdDLGFBQWE7QUFDYixNQUFNLFNBQVMsR0FBRyxTQUFTLENBQUMsU0FBUyxDQUFDLENBQUEsNEJBQTRCO0FBQ2xFLDJEQUFvRDtBQUNwRCw0Q0FBb0M7QUFFcEMsTUFBYSxjQUFlLFNBQVEsbUNBQWU7SUFDbEQsWUFBWSxRQUFnQyxFQUFFLE9BQWdCO1FBQzdELEtBQUssRUFBRSxDQUFDO1FBNEJUOztXQUVHO1FBQ0gsbUJBQWMsR0FVVjtZQUNILE9BQU8sRUFBRSxDQUFDO1lBQ1YsYUFBYTtZQUNiLE9BQU8sRUFBRSxFQUFFO1lBQ1gsUUFBUSxFQUFFLEVBQUU7WUFDWixPQUFPLEVBQUUsRUFBRTtZQUNYLElBQUksRUFBRSxHQUFXLEVBQUU7Z0JBQ2xCLE1BQU0sRUFDTCxPQUFPLEVBQ1AsVUFBVSxFQUNWLEdBQUcsSUFBSSxDQUFDLGFBQWEsQ0FBQyxTQUFTLEVBQUUsSUFBSSxDQUFDLGNBQWMsQ0FBQyxPQUFPLENBQUMsQ0FBQztnQkFFL0QsSUFBSSxDQUFDLGNBQWMsQ0FBQyxPQUFPLEdBQUc7b0JBQzdCLE9BQU87b0JBQ1AsVUFBVTtpQkFDVixDQUFDO2dCQUNGLElBQUksQ0FBQyxjQUFjLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxHQUFHLFVBQVUsQ0FBQztnQkFDbkQsSUFBSSxDQUFDLGNBQWMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxPQUFPLENBQUMsR0FBRyxPQUFPLENBQUM7Z0JBQ25FLElBQUksQ0FBQyxjQUFjLENBQUMsT0FBTyxJQUFJLENBQUMsQ0FBQztnQkFDakMsT0FBTyxPQUFPLENBQUM7WUFDaEIsQ0FBQztZQUNELE9BQU8sQ0FBQyxDQUFTO2dCQUNoQixJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7b0JBQ1QsSUFBSSxDQUFDLE9BQU8sR0FBRyxDQUFDLENBQUM7Z0JBQ2xCLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQztZQUNiLENBQUM7U0FDRCxDQUFDO1FBRUY7O1dBRUc7UUFDSCxrQkFBYSxHQVdUO1lBQ0gsT0FBTyxFQUFFLENBQUM7WUFDVixhQUFhO1lBQ2IsT0FBTyxFQUFFLEVBQUU7WUFDWCxRQUFRLEVBQUUsRUFBRTtZQUNaLE9BQU8sRUFBRSxFQUFFO1lBQ1gsSUFBSSxFQUFFLEdBQVcsRUFBRTtnQkFDbEIsTUFBTSxFQUNMLE9BQU8sRUFDUCxVQUFVLEVBQ1YsR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUMsYUFBYSxDQUFDLE9BQU8sQ0FBQyxDQUFDO2dCQUU3RCxJQUFJLENBQUMsYUFBYSxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsR0FBRyxVQUFVLENBQUM7Z0JBQ2xELElBQUksQ0FBQyxhQUFhLENBQUMsT0FBTyxHQUFHO29CQUM1QixPQUFPO29CQUNQLFVBQVU7aUJBQ1YsQ0FBQztnQkFDRixJQUFJLENBQUMsYUFBYSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLE9BQU8sQ0FBQyxHQUFHLE9BQU8sQ0FBQztnQkFDakUsSUFBSSxDQUFDLGFBQWEsQ0FBQyxPQUFPLElBQUksQ0FBQyxDQUFDO2dCQUNoQyxPQUFPLE9BQU8sQ0FBQztZQUNoQixDQUFDO1lBQ0QsT0FBTyxDQUFDLENBQVM7Z0JBQ2hCLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztvQkFDVCxJQUFJLENBQUMsT0FBTyxHQUFHLENBQUMsQ0FBQztnQkFDbEIsd0RBQXdEO1lBQ3pELENBQUM7WUFDRCxPQUFPO2dCQUNOLElBQUksSUFBSSxDQUFDLE9BQU8sR0FBRyxDQUFDO29CQUNuQixJQUFJLENBQUMsT0FBTyxJQUFJLENBQUMsQ0FBQztZQUNwQixDQUFDO1NBQ0QsQ0FBQztRQWhIRCxJQUFJLENBQUMsUUFBUSxHQUFHLFFBQVEsQ0FBQztRQUN6QixJQUFJLENBQUMsT0FBTyxHQUFHLE9BQU8sQ0FBQztJQUN4QixDQUFDO0lBTUQsSUFBSSxHQUFHO1FBQ04sdUNBQ0ksSUFBSSxDQUFDLGNBQWMsQ0FBQyxRQUFRLEdBQzVCLElBQUksQ0FBQyxhQUFhLENBQUMsUUFBUSxFQUM3QjtJQUNILENBQUM7SUFFRCxJQUFJLFdBQVc7UUFDZCxNQUFNLE9BQU8sR0FBRyxNQUFNLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsT0FBTyxDQUFDO2FBQ3pELE1BQU0sQ0FDTixDQUFDLE1BQXdCLEVBQUUsRUFBRSxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLElBQUksSUFBSSxDQUFDLGNBQWMsQ0FBQyxPQUFPLEdBQUcsQ0FBQyxDQUN4RjthQUNBLEdBQUcsQ0FBQyxDQUFDLE1BQXdCLEVBQUUsRUFBRSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQy9DLE1BQU0sTUFBTSxHQUFHLE1BQU0sQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxPQUFPLENBQUM7YUFDdkQsTUFBTSxDQUFDLENBQUMsTUFBd0IsRUFBRSxFQUFFLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsSUFBSSxJQUFJLENBQUMsYUFBYSxDQUFDLE9BQU8sQ0FBQzthQUMzRixHQUFHLENBQUMsQ0FBQyxNQUF3QixFQUFFLEVBQUUsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUMvQyxPQUFPLENBQUMsR0FBRyxPQUFPLEVBQUUsR0FBRyxNQUFNLENBQUMsQ0FBQztJQUNoQyxDQUFDO0lBeUZPLGFBQWEsQ0FDcEIsVUFBZ0MsRUFDaEMsS0FBYTtRQUtiLHVCQUF1QjtRQUN2QixNQUFNLEtBQUssR0FBRyxVQUFVLEtBQUssU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUMvQyxNQUFNLEVBQUMsVUFBVSxFQUFDLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxXQUFXLENBQUMsZ0JBQWdCLEtBQUssS0FBSyxLQUFLLEdBQUcsQ0FBQyxDQUFDO1FBQ25GLHVCQUF1QjtRQUN2Qix1RUFBdUU7UUFDdkUsTUFBTSxXQUFXLEdBQUcsU0FBUyxDQUFDLHVCQUF1QixDQUFDLFVBQVUsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDO1FBQzdFLHVCQUF1QjtRQUV2QiwwREFBMEQ7UUFDMUQsMkdBQTJHO1FBQzNHLDhEQUE4RDtRQUM5RCxxREFBcUQ7UUFDckQsNERBQTREO1FBQzVELElBQUksS0FBSyxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsV0FBVyxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBQzVDLFlBQVk7UUFFWixJQUFJLE9BQU8sR0FBRyxTQUFTLENBQUMsT0FBTyxDQUFDLG1CQUFtQixDQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsUUFBUSxFQUFFLENBQUM7UUFFcEY7Ozs7Ozs7OztXQVNHO1FBQ0gseUZBQXlGO1FBQ3pGLHdDQUF3QztRQUN4QyxJQUFBLFlBQUcsRUFBQyxHQUFHLEVBQUU7WUFDUixJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsRUFBRTtnQkFDeEIsSUFBSSxFQUFFLFVBQVU7Z0JBQ2hCLE9BQU87Z0JBQ1AsS0FBSzthQUNMLENBQUMsQ0FBQztRQUNKLENBQUMsQ0FBQyxDQUFBO1FBRUYsT0FBTztZQUNOLE9BQU87WUFDUCxVQUFVO1NBQ1YsQ0FBQztJQUNILENBQUM7SUFFRDs7Ozs7T0FLRztJQUNILFlBQVksQ0FBQyxDQUFTLEVBQUUsVUFBZ0MsRUFBRSxNQUFNLEdBQUcsQ0FBQztRQUNuRSxPQUFPLENBQUMsR0FBRyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRTtZQUNyQyxNQUFNLEtBQUssR0FBRyxDQUFDLEdBQUcsTUFBTSxDQUFDO1lBQ3pCLE1BQU0sRUFDTCxPQUFPLEVBQ1AsVUFBVSxFQUNWLEdBQUcsSUFBSSxDQUFDLGFBQWEsQ0FBQyxVQUFVLEVBQUUsS0FBSyxDQUFDLENBQUM7WUFFMUMsSUFBSSxVQUFVLEtBQUssU0FBUyxFQUFFLENBQUM7Z0JBQzlCLElBQUksQ0FBQyxjQUFjLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxHQUFHLE9BQU8sQ0FBQztnQkFDN0MsSUFBSSxDQUFDLGNBQWMsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLEdBQUcsVUFBVSxDQUFDO1lBQ3BELENBQUM7aUJBQU0sQ0FBQztnQkFDUCxJQUFJLENBQUMsYUFBYSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsR0FBRyxPQUFPLENBQUM7Z0JBQzVDLElBQUksQ0FBQyxhQUFhLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxHQUFHLFVBQVUsQ0FBQztZQUNuRCxDQUFDO1lBQ0QsT0FBTztnQkFDTixLQUFLO2dCQUNMLE9BQU87Z0JBQ1AsVUFBVTthQUNWLENBQUM7UUFDSCxDQUFDLENBQUMsQ0FBQztJQUNKLENBQUM7SUFFRCxLQUFLLENBQUMsT0FBYztRQUNuQixPQUFPLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxJQUFJLElBQUksQ0FBQyxjQUFjLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7SUFDMUYsQ0FBQztJQUVELFdBQVcsQ0FBQyxPQUFjO1FBQ3pCLE9BQU8sQ0FBQyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxDQUFDO0lBQy9DLENBQUM7Q0FFRDtBQTdNRCx3Q0E2TUMiLCJzb3VyY2VzQ29udGVudCI6WyIvLyBAdHMtaWdub3JlXG5pbXBvcnQgKiBhcyBrYXNwYWNvcmUgZnJvbSAnQGthc3BhL2NvcmUtbGliJztcbmltcG9ydCB7TmV0d29ya30gZnJvbSAnY3VzdG9tLXR5cGVzJztcblxuLy8gQHRzLWlnbm9yZVxuY29uc3Qgc2VjcDI1NmsxID0ga2FzcGFjb3JlLnNlY3AyNTZrMTsvL3JlcXVpcmUoJ3NlY3AyNTZrMS13YXNtJyk7XG5pbXBvcnQge0V2ZW50VGFyZ2V0SW1wbH0gZnJvbSAnLi9ldmVudC10YXJnZXQtaW1wbCc7XG5pbXBvcnQge2RwY30gZnJvbSAnLi4vdXRpbHMvaGVscGVyJztcblxuZXhwb3J0IGNsYXNzIEFkZHJlc3NNYW5hZ2VyIGV4dGVuZHMgRXZlbnRUYXJnZXRJbXBsIHtcblx0Y29uc3RydWN0b3IoSERXYWxsZXQ6IGthc3BhY29yZS5IRFByaXZhdGVLZXksIG5ldHdvcms6IE5ldHdvcmspIHtcblx0XHRzdXBlcigpO1xuXHRcdHRoaXMuSERXYWxsZXQgPSBIRFdhbGxldDtcblx0XHR0aGlzLm5ldHdvcmsgPSBuZXR3b3JrO1xuXHR9XG5cblx0cHJpdmF0ZSBIRFdhbGxldDoga2FzcGFjb3JlLkhEUHJpdmF0ZUtleTtcblxuXHRuZXR3b3JrOiBOZXR3b3JrO1xuXG5cdGdldCBhbGwoKTogUmVjb3JkIDwgc3RyaW5nLCBrYXNwYWNvcmUuUHJpdmF0ZUtleSA+IHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0Li4udGhpcy5yZWNlaXZlQWRkcmVzcy5rZXlwYWlycyxcblx0XHRcdC4uLnRoaXMuY2hhbmdlQWRkcmVzcy5rZXlwYWlyc1xuXHRcdH07XG5cdH1cblxuXHRnZXQgc2hvdWxkRmV0Y2goKTogc3RyaW5nW10ge1xuXHRcdGNvbnN0IHJlY2VpdmUgPSBPYmplY3QuZW50cmllcyh0aGlzLnJlY2VpdmVBZGRyZXNzLmF0SW5kZXgpXG5cdFx0XHQuZmlsdGVyKFxuXHRcdFx0XHQocmVjb3JkOiBbc3RyaW5nLCBzdHJpbmddKSA9PiBwYXJzZUludChyZWNvcmRbMF0sIDEwKSA8PSB0aGlzLnJlY2VpdmVBZGRyZXNzLmNvdW50ZXIgLSAxXG5cdFx0XHQpXG5cdFx0XHQubWFwKChyZWNvcmQ6IFtzdHJpbmcsIHN0cmluZ10pID0+IHJlY29yZFsxXSk7XG5cdFx0Y29uc3QgY2hhbmdlID0gT2JqZWN0LmVudHJpZXModGhpcy5jaGFuZ2VBZGRyZXNzLmF0SW5kZXgpXG5cdFx0XHQuZmlsdGVyKChyZWNvcmQ6IFtzdHJpbmcsIHN0cmluZ10pID0+IHBhcnNlSW50KHJlY29yZFswXSwgMTApIDw9IHRoaXMuY2hhbmdlQWRkcmVzcy5jb3VudGVyKVxuXHRcdFx0Lm1hcCgocmVjb3JkOiBbc3RyaW5nLCBzdHJpbmddKSA9PiByZWNvcmRbMV0pO1xuXHRcdHJldHVybiBbLi4ucmVjZWl2ZSwgLi4uY2hhbmdlXTtcblx0fVxuXG5cdC8qKlxuXHQgKiBEZXJpdmVzIGEgbmV3IHJlY2VpdmUgYWRkcmVzcy4gU2V0cyByZWxhdGVkIGluc3RhbmNlIHByb3BlcnRpZXMuXG5cdCAqL1xuXHRyZWNlaXZlQWRkcmVzczoge1xuXHRcdGNvdW50ZXI6IG51bWJlcjtcblx0XHRjdXJyZW50OiB7XG5cdFx0XHRhZGRyZXNzOiBzdHJpbmc7XG5cdFx0XHRwcml2YXRlS2V5OiBrYXNwYWNvcmUuUHJpdmF0ZUtleVxuXHRcdH07XG5cdFx0a2V5cGFpcnM6IFJlY29yZCA8IHN0cmluZywga2FzcGFjb3JlLlByaXZhdGVLZXkgPiA7XG5cdFx0YXRJbmRleDogUmVjb3JkIDwgc3RyaW5nLCBzdHJpbmcgPiA7XG5cdFx0bmV4dDogKCkgPT4gc3RyaW5nO1xuXHRcdGFkdmFuY2U6IChuOiBudW1iZXIpID0+IHZvaWQ7XG5cdH0gPSB7XG5cdFx0Y291bnRlcjogMCxcblx0XHQvLyBAdHMtaWdub3JlXG5cdFx0Y3VycmVudDoge30sXG5cdFx0a2V5cGFpcnM6IHt9LFxuXHRcdGF0SW5kZXg6IHt9LFxuXHRcdG5leHQ6ICgpOiBzdHJpbmcgPT4ge1xuXHRcdFx0Y29uc3Qge1xuXHRcdFx0XHRhZGRyZXNzLFxuXHRcdFx0XHRwcml2YXRlS2V5XG5cdFx0XHR9ID0gdGhpcy5kZXJpdmVBZGRyZXNzKCdyZWNlaXZlJywgdGhpcy5yZWNlaXZlQWRkcmVzcy5jb3VudGVyKTtcblxuXHRcdFx0dGhpcy5yZWNlaXZlQWRkcmVzcy5jdXJyZW50ID0ge1xuXHRcdFx0XHRhZGRyZXNzLFxuXHRcdFx0XHRwcml2YXRlS2V5XG5cdFx0XHR9O1xuXHRcdFx0dGhpcy5yZWNlaXZlQWRkcmVzcy5rZXlwYWlyc1thZGRyZXNzXSA9IHByaXZhdGVLZXk7XG5cdFx0XHR0aGlzLnJlY2VpdmVBZGRyZXNzLmF0SW5kZXhbdGhpcy5yZWNlaXZlQWRkcmVzcy5jb3VudGVyXSA9IGFkZHJlc3M7XG5cdFx0XHR0aGlzLnJlY2VpdmVBZGRyZXNzLmNvdW50ZXIgKz0gMTtcblx0XHRcdHJldHVybiBhZGRyZXNzO1xuXHRcdH0sXG5cdFx0YWR2YW5jZShuOiBudW1iZXIpOiB2b2lkIHtcblx0XHRcdGlmIChuID4gLTEpXG5cdFx0XHRcdHRoaXMuY291bnRlciA9IG47XG5cdFx0XHR0aGlzLm5leHQoKTtcblx0XHR9LFxuXHR9O1xuXG5cdC8qKlxuXHQgKiBEZXJpdmVzIGEgbmV3IGNoYW5nZSBhZGRyZXNzLiBTZXRzIHJlbGF0ZWQgaW5zdGFuY2UgcHJvcGVydGllcy5cblx0ICovXG5cdGNoYW5nZUFkZHJlc3M6IHtcblx0XHRjb3VudGVyOiBudW1iZXI7XG5cdFx0Y3VycmVudDoge1xuXHRcdFx0YWRkcmVzczogc3RyaW5nO1xuXHRcdFx0cHJpdmF0ZUtleToga2FzcGFjb3JlLlByaXZhdGVLZXlcblx0XHR9O1xuXHRcdGtleXBhaXJzOiBSZWNvcmQgPCBzdHJpbmcsIGthc3BhY29yZS5Qcml2YXRlS2V5ID4gO1xuXHRcdGF0SW5kZXg6IFJlY29yZCA8IHN0cmluZywgc3RyaW5nID4gO1xuXHRcdG5leHQ6ICgpID0+IHN0cmluZztcblx0XHRhZHZhbmNlOiAobjogbnVtYmVyKSA9PiB2b2lkO1xuXHRcdHJldmVyc2U6ICgpID0+IHZvaWQ7XG5cdH0gPSB7XG5cdFx0Y291bnRlcjogMCxcblx0XHQvLyBAdHMtaWdub3JlXG5cdFx0Y3VycmVudDoge30sXG5cdFx0a2V5cGFpcnM6IHt9LFxuXHRcdGF0SW5kZXg6IHt9LFxuXHRcdG5leHQ6ICgpOiBzdHJpbmcgPT4ge1xuXHRcdFx0Y29uc3Qge1xuXHRcdFx0XHRhZGRyZXNzLFxuXHRcdFx0XHRwcml2YXRlS2V5XG5cdFx0XHR9ID0gdGhpcy5kZXJpdmVBZGRyZXNzKCdjaGFuZ2UnLCB0aGlzLmNoYW5nZUFkZHJlc3MuY291bnRlcik7XG5cblx0XHRcdHRoaXMuY2hhbmdlQWRkcmVzcy5rZXlwYWlyc1thZGRyZXNzXSA9IHByaXZhdGVLZXk7XG5cdFx0XHR0aGlzLmNoYW5nZUFkZHJlc3MuY3VycmVudCA9IHtcblx0XHRcdFx0YWRkcmVzcyxcblx0XHRcdFx0cHJpdmF0ZUtleVxuXHRcdFx0fTtcblx0XHRcdHRoaXMuY2hhbmdlQWRkcmVzcy5hdEluZGV4W3RoaXMuY2hhbmdlQWRkcmVzcy5jb3VudGVyXSA9IGFkZHJlc3M7XG5cdFx0XHR0aGlzLmNoYW5nZUFkZHJlc3MuY291bnRlciArPSAxO1xuXHRcdFx0cmV0dXJuIGFkZHJlc3M7XG5cdFx0fSxcblx0XHRhZHZhbmNlKG46IG51bWJlcik6IHZvaWQge1xuXHRcdFx0aWYgKG4gPiAtMSlcblx0XHRcdFx0dGhpcy5jb3VudGVyID0gbjtcblx0XHRcdC8vIG5vIGNhbGwgdG8gbmV4dCgpIGhlcmU7IGNvbXBvc2VUeCBjYWxscyBpdCBvbiBkZW1hbmQuXG5cdFx0fSxcblx0XHRyZXZlcnNlKCk6IHZvaWQge1xuXHRcdFx0aWYgKHRoaXMuY291bnRlciA+IDApXG5cdFx0XHRcdHRoaXMuY291bnRlciAtPSAxO1xuXHRcdH0sXG5cdH07XG5cblx0cHJpdmF0ZSBkZXJpdmVBZGRyZXNzKFxuXHRcdGRlcml2ZVR5cGU6ICdyZWNlaXZlJyB8ICdjaGFuZ2UnLFxuXHRcdGluZGV4OiBudW1iZXJcblx0KToge1xuXHRcdGFkZHJlc3M6IHN0cmluZztcblx0XHRwcml2YXRlS2V5OiBrYXNwYWNvcmUuUHJpdmF0ZUtleVxuXHR9IHtcblx0XHQvL2xldCB0czAgPSBEYXRlLm5vdygpO1xuXHRcdGNvbnN0IGRUeXBlID0gZGVyaXZlVHlwZSA9PT0gJ3JlY2VpdmUnID8gMCA6IDE7XG5cdFx0Y29uc3Qge3ByaXZhdGVLZXl9ID0gdGhpcy5IRFdhbGxldC5kZXJpdmVDaGlsZChgbS80NCcvOTcyLzAnLyR7ZFR5cGV9Jy8ke2luZGV4fSdgKTtcblx0XHQvL2xldCB0czEgPSBEYXRlLm5vdygpO1xuXHRcdC8vbGV0IHB1YmxpY0tleXMgPSBzZWNwMjU2azEuZXhwb3J0X3B1YmxpY19rZXlzKHByaXZhdGVLZXkudG9TdHJpbmcoKSk7XG5cdFx0Y29uc3QgeG9ubHlQdWJLZXkgPSBzZWNwMjU2azEuZXhwb3J0X3B1YmxpY19rZXlfeG9ubHkocHJpdmF0ZUtleS50b1N0cmluZygpKTtcblx0XHQvL2xldCB0czIgPSBEYXRlLm5vdygpO1xuXG5cdFx0Ly9jb25zb2xlLmxvZygnZHVyYXRpb25zOicsKHRzMi10czEpLzEwMDAsKHRzMS10czApLzEwMDApO1xuXHRcdC8vbGV0IGFkZHJlc3MxID0gbmV3IGthc3BhY29yZS5QdWJsaWNLZXkocHVibGljS2V5cy5wdWJrZXksIHtuZXR3b3JrOnRoaXMubmV0d29ya30pLnRvQWRkcmVzcygpLnRvU3RyaW5nKCk7XG5cdFx0Ly9sZXQgYWRkcmVzcyA9IHByaXZhdGVLZXkudG9BZGRyZXNzKHRoaXMubmV0d29yaykudG9TdHJpbmcoKTtcblx0XHQvL2xldCBwdWJrZXkgPSBCdWZmZXIuZnJvbShwdWJsaWNLZXlzLnB1YmtleSwgXCJoZXhcIik7XG5cdFx0Ly9sZXQge2FkZHJlc3M6YWRkcmVzczN9ID0gYml0Y29pbi5wYXltZW50cy5wMnBraCh7cHVia2V5fSk7XG5cdFx0bGV0IHhvbmx5ID0gQnVmZmVyLmZyb20oeG9ubHlQdWJLZXksIFwiaGV4XCIpO1xuXHRcdC8vQHRzLWlnbm9yZVxuXHRcdFxuXHRcdGxldCBhZGRyZXNzID0ga2FzcGFjb3JlLkFkZHJlc3MuZnJvbVB1YmxpY0tleUJ1ZmZlcih4b25seSwgdGhpcy5uZXR3b3JrKS50b1N0cmluZygpO1xuXG5cdFx0Lypcblx0XHRjb25zb2xlLmxvZyhcInByaXZhdGVLZXk6eHh4eDpcIiwge1xuXHRcdCAgcHJpdmF0ZUtleTogcHJpdmF0ZUtleS50b1N0cmluZygpLFxuXHRcdCAgYWRkcmVzcyxcblx0XHQgIGFkZHJlc3MxLFxuXHRcdCAgYWRkcmVzczIsXG5cdFx0ICBcImFkZHJlc3MxPT1hZGRyZXNzXCI6YWRkcmVzczE9PWFkZHJlc3MsXG5cdFx0ICBwdWJsaWNLZXlzXG5cdFx0IH0pOy8vLCBwdWJsaWNLZXlzKVxuXHRcdCAqL1xuXHRcdC8vY29uc29sZS5sb2coXCJ4b25seTphZGRyZXNzMlwiLCBcInByaXZhdGVLZXk6XCIrcHJpdmF0ZUtleS50b1N0cmluZygpLCBcImFkZHJlc3M6XCIrYWRkcmVzczIpXG5cdFx0Ly9jb25zb2xlLmxvZyhcInhvbmx5XCIsIHB1YmxpY0tleXMueG9ubHkpXG5cdFx0ZHBjKCgpID0+IHtcblx0XHRcdHRoaXMuZW1pdChcIm5ldy1hZGRyZXNzXCIsIHtcblx0XHRcdFx0dHlwZTogZGVyaXZlVHlwZSxcblx0XHRcdFx0YWRkcmVzcyxcblx0XHRcdFx0aW5kZXhcblx0XHRcdH0pO1xuXHRcdH0pXG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0YWRkcmVzcyxcblx0XHRcdHByaXZhdGVLZXlcblx0XHR9O1xuXHR9XG5cblx0LyoqXG5cdCAqIERlcml2ZXMgbiBhZGRyZXNzZXMgYW5kIGFkZHMgdGhlaXIga2V5cGFpcnMgdG8gdGhlaXIgZGVyaXZlVHlwZS1yZXNwZWN0aXZlIGFkZHJlc3Mgb2JqZWN0XG5cdCAqIEBwYXJhbSBuIEhvdyBtYW55IGFkZHJlc3NlcyB0byBkZXJpdmVcblx0ICogQHBhcmFtIGRlcml2ZVR5cGUgcmVjZWl2ZSBvciBjaGFuZ2UgYWRkcmVzc1xuXHQgKiBAcGFyYW0gb2Zmc2V0IEluZGV4IHRvIHN0YXJ0IGF0IGluIGRlcml2ZSBwYXRoXG5cdCAqL1xuXHRnZXRBZGRyZXNzZXMobjogbnVtYmVyLCBkZXJpdmVUeXBlOiAncmVjZWl2ZScgfCAnY2hhbmdlJywgb2Zmc2V0ID0gMCkge1xuXHRcdHJldHVybiBbLi4uQXJyYXkobikua2V5cygpXS5tYXAoKGkpID0+IHtcblx0XHRcdGNvbnN0IGluZGV4ID0gaSArIG9mZnNldDtcblx0XHRcdGNvbnN0IHtcblx0XHRcdFx0YWRkcmVzcyxcblx0XHRcdFx0cHJpdmF0ZUtleVxuXHRcdFx0fSA9IHRoaXMuZGVyaXZlQWRkcmVzcyhkZXJpdmVUeXBlLCBpbmRleCk7XG5cblx0XHRcdGlmIChkZXJpdmVUeXBlID09PSAncmVjZWl2ZScpIHtcblx0XHRcdFx0dGhpcy5yZWNlaXZlQWRkcmVzcy5hdEluZGV4W2luZGV4XSA9IGFkZHJlc3M7XG5cdFx0XHRcdHRoaXMucmVjZWl2ZUFkZHJlc3Mua2V5cGFpcnNbYWRkcmVzc10gPSBwcml2YXRlS2V5O1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5jaGFuZ2VBZGRyZXNzLmF0SW5kZXhbaW5kZXhdID0gYWRkcmVzcztcblx0XHRcdFx0dGhpcy5jaGFuZ2VBZGRyZXNzLmtleXBhaXJzW2FkZHJlc3NdID0gcHJpdmF0ZUtleTtcblx0XHRcdH1cblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGluZGV4LFxuXHRcdFx0XHRhZGRyZXNzLFxuXHRcdFx0XHRwcml2YXRlS2V5LFxuXHRcdFx0fTtcblx0XHR9KTtcblx0fVxuXG5cdGlzT3VyKGFkZHJlc3M6c3RyaW5nKTpib29sZWFue1xuXHRcdHJldHVybiAhISh0aGlzLmNoYW5nZUFkZHJlc3Mua2V5cGFpcnNbYWRkcmVzc10gfHwgdGhpcy5yZWNlaXZlQWRkcmVzcy5rZXlwYWlyc1thZGRyZXNzXSk7XG5cdH1cblxuXHRpc091ckNoYW5nZShhZGRyZXNzOnN0cmluZyk6Ym9vbGVhbntcblx0XHRyZXR1cm4gISF0aGlzLmNoYW5nZUFkZHJlc3Mua2V5cGFpcnNbYWRkcmVzc107XG5cdH1cblxufSJdfQ==