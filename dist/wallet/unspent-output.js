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
exports.UnspentOutput = void 0;
const kaspacore = __importStar(require("@kaspa/core-lib"));
class UnspentOutput extends kaspacore.Transaction.UnspentOutput {
    constructor(o) {
        super(o);
        this.blockDaaScore = o.blockDaaScore;
        this.scriptPublicKeyVersion = o.scriptPublicKeyVersion;
        this.id = this.txId + this.outputIndex;
        this.signatureOPCount = this.script.getSignatureOperationsCount();
        this.mass = this.signatureOPCount * kaspacore.Transaction.MassPerSigOp;
        this.mass += 151 * kaspacore.Transaction.MassPerTxByte; //standalone mass 
        this.isCoinbase = o.isCoinbase,
            this.scriptPubKey = o.scriptPubKey;
    }
}
exports.UnspentOutput = UnspentOutput;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidW5zcGVudC1vdXRwdXQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi93YWxsZXQvdW5zcGVudC1vdXRwdXQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsMkRBQTZDO0FBRTdDLE1BQWEsYUFBYyxTQUFRLFNBQVMsQ0FBQyxXQUFXLENBQUMsYUFBYTtJQVFyRSxZQUFZLENBQW9CO1FBQy9CLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNULElBQUksQ0FBQyxhQUFhLEdBQUcsQ0FBQyxDQUFDLGFBQWEsQ0FBQztRQUNyQyxJQUFJLENBQUMsc0JBQXNCLEdBQUcsQ0FBQyxDQUFDLHNCQUFzQixDQUFDO1FBQ3ZELElBQUksQ0FBQyxFQUFFLEdBQUcsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDO1FBQ3ZDLElBQUksQ0FBQyxnQkFBZ0IsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLDJCQUEyQixFQUFFLENBQUM7UUFDbEUsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLENBQUMsZ0JBQWdCLEdBQUcsU0FBUyxDQUFDLFdBQVcsQ0FBQyxZQUFZLENBQUM7UUFDdkUsSUFBSSxDQUFDLElBQUksSUFBRyxHQUFHLEdBQUcsU0FBUyxDQUFDLFdBQVcsQ0FBQyxhQUFhLENBQUMsQ0FBQyxrQkFBa0I7UUFDekUsSUFBSSxDQUFDLFVBQVUsR0FBRyxDQUFDLENBQUMsVUFBVTtZQUM5QixJQUFJLENBQUMsWUFBWSxHQUFHLENBQUMsQ0FBQyxZQUFZLENBQUE7SUFDbkMsQ0FBQztDQUNEO0FBbkJELHNDQW1CQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGthc3BhY29yZSBmcm9tICdAa2FzcGEvY29yZS1saWInO1xuaW1wb3J0IHtVbnNwZW50T3V0cHV0SW5mb30gZnJvbSAnLi4vdHlwZXMvY3VzdG9tLXR5cGVzJztcbmV4cG9ydCBjbGFzcyBVbnNwZW50T3V0cHV0IGV4dGVuZHMga2FzcGFjb3JlLlRyYW5zYWN0aW9uLlVuc3BlbnRPdXRwdXQge1xuXHRibG9ja0RhYVNjb3JlOiBudW1iZXI7XG5cdHNjcmlwdFB1YmxpY0tleVZlcnNpb246IG51bWJlcjtcblx0aWQ6c3RyaW5nO1xuXHRzaWduYXR1cmVPUENvdW50Om51bWJlcjtcblx0bWFzczpudW1iZXI7XG5cdGlzQ29pbmJhc2U6Ym9vbGVhbjtcblx0c2NyaXB0UHViS2V5OnN0cmluZztcblx0Y29uc3RydWN0b3IobzogVW5zcGVudE91dHB1dEluZm8pIHtcblx0XHRzdXBlcihvKTtcblx0XHR0aGlzLmJsb2NrRGFhU2NvcmUgPSBvLmJsb2NrRGFhU2NvcmU7XG5cdFx0dGhpcy5zY3JpcHRQdWJsaWNLZXlWZXJzaW9uID0gby5zY3JpcHRQdWJsaWNLZXlWZXJzaW9uO1xuXHRcdHRoaXMuaWQgPSB0aGlzLnR4SWQgKyB0aGlzLm91dHB1dEluZGV4O1xuXHRcdHRoaXMuc2lnbmF0dXJlT1BDb3VudCA9IHRoaXMuc2NyaXB0LmdldFNpZ25hdHVyZU9wZXJhdGlvbnNDb3VudCgpO1xuXHRcdHRoaXMubWFzcyA9IHRoaXMuc2lnbmF0dXJlT1BDb3VudCAqIGthc3BhY29yZS5UcmFuc2FjdGlvbi5NYXNzUGVyU2lnT3A7XG5cdFx0dGhpcy5tYXNzKz0gMTUxICoga2FzcGFjb3JlLlRyYW5zYWN0aW9uLk1hc3NQZXJUeEJ5dGU7IC8vc3RhbmRhbG9uZSBtYXNzIFxuXHRcdHRoaXMuaXNDb2luYmFzZSA9IG8uaXNDb2luYmFzZSxcblx0XHR0aGlzLnNjcmlwdFB1YktleSA9IG8uc2NyaXB0UHViS2V5XG5cdH1cbn1cbiJdfQ==