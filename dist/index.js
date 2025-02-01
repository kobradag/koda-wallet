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
exports.kaspacore = exports.FlowLogger = exports.Storage = exports.helper = exports.EventTargetImpl = exports.log = exports.initKaspaFramework = exports.Wallet = exports.COINBASE_CFM_COUNT = exports.CONFIRMATION_COUNT = void 0;
const logger_1 = require("./utils/logger");
Object.defineProperty(exports, "log", { enumerable: true, get: function () { return logger_1.log; } });
Object.defineProperty(exports, "FlowLogger", { enumerable: true, get: function () { return logger_1.FlowLogger; } });
const wallet_1 = require("./wallet/wallet");
Object.defineProperty(exports, "Wallet", { enumerable: true, get: function () { return wallet_1.Wallet; } });
Object.defineProperty(exports, "Storage", { enumerable: true, get: function () { return wallet_1.Storage; } });
Object.defineProperty(exports, "kaspacore", { enumerable: true, get: function () { return wallet_1.kaspacore; } });
Object.defineProperty(exports, "CONFIRMATION_COUNT", { enumerable: true, get: function () { return wallet_1.CONFIRMATION_COUNT; } });
Object.defineProperty(exports, "COINBASE_CFM_COUNT", { enumerable: true, get: function () { return wallet_1.COINBASE_CFM_COUNT; } });
const initKaspaFramework_1 = require("./wallet/initKaspaFramework");
Object.defineProperty(exports, "initKaspaFramework", { enumerable: true, get: function () { return initKaspaFramework_1.initKaspaFramework; } });
const event_target_impl_1 = require("./wallet/event-target-impl");
Object.defineProperty(exports, "EventTargetImpl", { enumerable: true, get: function () { return event_target_impl_1.EventTargetImpl; } });
const helper = __importStar(require("./utils/helper"));
exports.helper = helper;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9pbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSwyQ0FBK0M7QUFPWCxvRkFQNUIsWUFBRyxPQU80QjtBQUFvQywyRkFQOUQsbUJBQVUsT0FPOEQ7QUFOckYsNENBQW1HO0FBTTNGLHVGQU5BLGVBQU0sT0FNQTtBQUFvRCx3RkFObEQsZ0JBQU8sT0FNa0Q7QUFBYywwRkFOOUQsa0JBQVMsT0FNOEQ7QUFEeEYsbUdBTDRCLDJCQUFrQixPQUs1QjtBQUFFLG1HQUw0QiwyQkFBa0IsT0FLNUI7QUFKOUMsb0VBQStEO0FBSy9DLG1HQUxSLHVDQUFrQixPQUtRO0FBSmxDLGtFQUEyRDtBQUlsQixnR0FKakMsbUNBQWUsT0FJaUM7QUFIeEQsdURBQXlDO0FBR2lCLHdCQUFNIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHtsb2csIEZsb3dMb2dnZXJ9IGZyb20gXCIuL3V0aWxzL2xvZ2dlclwiO1xuaW1wb3J0IHtXYWxsZXQsIFN0b3JhZ2UsIGthc3BhY29yZSwgQ09ORklSTUFUSU9OX0NPVU5ULCBDT0lOQkFTRV9DRk1fQ09VTlR9IGZyb20gXCIuL3dhbGxldC93YWxsZXRcIjtcbmltcG9ydCB7aW5pdEthc3BhRnJhbWV3b3JrfSBmcm9tICcuL3dhbGxldC9pbml0S2FzcGFGcmFtZXdvcmsnO1xuaW1wb3J0IHtFdmVudFRhcmdldEltcGx9IGZyb20gJy4vd2FsbGV0L2V2ZW50LXRhcmdldC1pbXBsJztcbmltcG9ydCAqIGFzIGhlbHBlciBmcm9tICcuL3V0aWxzL2hlbHBlcic7XG5cbmV4cG9ydCB7Q09ORklSTUFUSU9OX0NPVU5ULCBDT0lOQkFTRV9DRk1fQ09VTlR9O1xuZXhwb3J0IHtXYWxsZXQsIGluaXRLYXNwYUZyYW1ld29yaywgbG9nLCBFdmVudFRhcmdldEltcGwsIGhlbHBlciwgU3RvcmFnZSwgRmxvd0xvZ2dlciwga2FzcGFjb3JlfSJdfQ==