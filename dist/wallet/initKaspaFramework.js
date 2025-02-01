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
exports.initKaspaFramework = void 0;
const wallet_1 = require("./wallet");
const initKaspaFramework = () => __awaiter(void 0, void 0, void 0, function* () {
    // console.log("Kaspa - framework: init");
    yield wallet_1.Wallet.initRuntime();
    // console.log("Kaspa - framework: ready");
});
exports.initKaspaFramework = initKaspaFramework;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5pdEthc3BhRnJhbWV3b3JrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vd2FsbGV0L2luaXRLYXNwYUZyYW1ld29yay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7QUFBQSxxQ0FBa0M7QUFFM0IsTUFBTSxrQkFBa0IsR0FBRyxHQUFTLEVBQUU7SUFDM0MsMENBQTBDO0lBQzFDLE1BQU0sZUFBTSxDQUFDLFdBQVcsRUFBRSxDQUFDO0lBQzNCLDJDQUEyQztBQUM3QyxDQUFDLENBQUEsQ0FBQztBQUpXLFFBQUEsa0JBQWtCLHNCQUk3QiIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IFdhbGxldCB9IGZyb20gJy4vd2FsbGV0JztcblxuZXhwb3J0IGNvbnN0IGluaXRLYXNwYUZyYW1ld29yayA9IGFzeW5jICgpID0+IHtcbiAgLy8gY29uc29sZS5sb2coXCJLYXNwYSAtIGZyYW1ld29yazogaW5pdFwiKTtcbiAgYXdhaXQgV2FsbGV0LmluaXRSdW50aW1lKCk7XG4gIC8vIGNvbnNvbGUubG9nKFwiS2FzcGEgLSBmcmFtZXdvcms6IHJlYWR5XCIpO1xufTtcblxuIl19