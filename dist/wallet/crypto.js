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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Crypto = void 0;
const crypto_js_1 = __importDefault(require("crypto-js"));
const JsonFormatter = (passSalt) => {
    return {
        stringify: function (cipherParams) {
            let data = [crypto_js_1.default.enc.Hex.stringify(cipherParams.ciphertext)];
            if (cipherParams.iv) {
                data.push(cipherParams.iv.toString());
            }
            else {
                data.push("");
            }
            if (cipherParams.salt) {
                data.push(cipherParams.salt.toString());
            }
            else {
                data.push("");
            }
            data.push(passSalt);
            return Crypto.toHexCode(data);
        },
        parse: function (hexCode) {
            //console.log("hexCode", hexCode)
            let [ct, iv, salt] = Crypto.parseHexCode(hexCode);
            let cipherParams = crypto_js_1.default.lib.CipherParams.create({
                ciphertext: crypto_js_1.default.enc.Hex.parse(ct)
            });
            if (iv) {
                cipherParams.iv = crypto_js_1.default.enc.Hex.parse(iv);
            }
            if (salt) {
                cipherParams.salt = crypto_js_1.default.enc.Hex.parse(salt);
            }
            return cipherParams;
        }
    };
};
class Crypto {
    static encrypt(passphrase, data) {
        return __awaiter(this, void 0, void 0, function* () {
            let { key, salt } = this.createKey(passphrase);
            //console.log("key, salt", {key, salt})
            return crypto_js_1.default.AES.encrypt(data, key, {
                mode: crypto_js_1.default.mode.CFB,
                padding: crypto_js_1.default.pad.AnsiX923,
                format: JsonFormatter(salt)
            }).toString();
        });
    }
    static decrypt(passphrase, data) {
        return __awaiter(this, void 0, void 0, function* () {
            let [ct, iv, salt, passSalt] = this.parseHexCode(data);
            let { key } = this.createKey(passphrase, passSalt);
            return crypto_js_1.default.AES.decrypt(data, key, {
                mode: crypto_js_1.default.mode.CFB,
                padding: crypto_js_1.default.pad.AnsiX923,
                format: JsonFormatter(passSalt)
            }).toString(crypto_js_1.default.enc.Utf8);
        });
    }
    static createKey(passphrase, saltStr = '') {
        let salt = saltStr ? crypto_js_1.default.enc.Hex.parse(saltStr) : crypto_js_1.default.lib.WordArray.random(128 / 8);
        return {
            key: crypto_js_1.default.PBKDF2(passphrase, salt, {
                keySize: 512 / 32,
                iterations: 1000
            }).toString(crypto_js_1.default.enc.Hex),
            salt: salt.toString(crypto_js_1.default.enc.Hex)
        };
    }
    static parseHexCode(hexCode) {
        let data = [];
        do {
            let l = parseInt(hexCode.substr(0, 5), 10);
            let c = hexCode.substr(5, l);
            data.push(c);
            hexCode = hexCode.substr(5 + l);
        } while (hexCode.length);
        return data;
        /*
        let words = CryptoJS.enc.Hex.parse(hexCode);
        return CryptoJS.enc.Utf8.stringify(words).split(",")
        */
    }
    static toHexCode(data) {
        return data.map(d => {
            return (d.length + "").padStart(5, '0') + d;
        }).join('');
        /*
        let words = CryptoJS.enc.Utf8.parse(data.join(","));
        let hex = CryptoJS.enc.Hex.stringify(words);
        //console.log("stringify:", data, "=>", words, "=>", hex)*/
    }
}
exports.Crypto = Crypto;
/*
const test = async()=>{
    const pass = "#drfgt Sf @33 gfdg dfg dfg";
    const data = "rfasdsdsvfgfgfg dsfsdf sdf sdf sdfsdf sdf sdf sf sdgdfg dfg dfg dfgfdgdf gsfd gdfs gsfd gsfd gdf gfdgfdgsdfrete rgdf dfgdfg";
    let encrypted = await Crypto.encrypt(pass, data)
    .catch((e:any)=>{
        console.log("error", e)
    })
    console.log("encrypted:", encrypted)
    if(!encrypted)
        return
    let decrypted = await Crypto.decrypt(pass, encrypted)
    //.catch((e:any)=>{
    //	console.log("error", e)
    //})
    console.log("decrypted:", decrypted==data, decrypted)
};

test().catch((e:any)=>{
    console.log("error", e)
})
*/
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY3J5cHRvLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vd2FsbGV0L2NyeXB0by50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7QUFBQSwwREFBaUM7QUFFakMsTUFBTSxhQUFhLEdBQUcsQ0FBQyxRQUFlLEVBQUMsRUFBRTtJQUN4QyxPQUFPO1FBQ04sU0FBUyxFQUFFLFVBQVMsWUFBc0M7WUFDekQsSUFBSSxJQUFJLEdBQUcsQ0FBQyxtQkFBUSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLFlBQVksQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFBO1lBQ2hFLElBQUksWUFBWSxDQUFDLEVBQUUsRUFBRSxDQUFDO2dCQUNyQixJQUFJLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxFQUFFLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQztZQUN2QyxDQUFDO2lCQUFJLENBQUM7Z0JBQ0wsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQztZQUNmLENBQUM7WUFDRCxJQUFJLFlBQVksQ0FBQyxJQUFJLEVBQUUsQ0FBQztnQkFDdkIsSUFBSSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUM7WUFDekMsQ0FBQztpQkFBSSxDQUFDO2dCQUNMLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7WUFDZixDQUFDO1lBQ0QsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQztZQUVwQixPQUFPLE1BQU0sQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDL0IsQ0FBQztRQUNELEtBQUssRUFBRSxVQUFTLE9BQWM7WUFDN0IsaUNBQWlDO1lBQ2pDLElBQUksQ0FBQyxFQUFFLEVBQUUsRUFBRSxFQUFFLElBQUksQ0FBQyxHQUFHLE1BQU0sQ0FBQyxZQUFZLENBQUMsT0FBTyxDQUFDLENBQUE7WUFFakQsSUFBSSxZQUFZLEdBQUcsbUJBQVEsQ0FBQyxHQUFHLENBQUMsWUFBWSxDQUFDLE1BQU0sQ0FBQztnQkFDbkQsVUFBVSxFQUFFLG1CQUFRLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDO2FBQ3RDLENBQUMsQ0FBQztZQUNILElBQUksRUFBRSxFQUFFLENBQUM7Z0JBQ1IsWUFBWSxDQUFDLEVBQUUsR0FBRyxtQkFBUSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxDQUFDO1lBQzlDLENBQUM7WUFDRCxJQUFJLElBQUksRUFBRSxDQUFDO2dCQUNWLFlBQVksQ0FBQyxJQUFJLEdBQUcsbUJBQVEsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUNsRCxDQUFDO1lBQ0QsT0FBTyxZQUFZLENBQUM7UUFDckIsQ0FBQztLQUNELENBQUE7QUFDRixDQUFDLENBQUM7QUFFRixNQUFhLE1BQU07SUFDbEIsTUFBTSxDQUFPLE9BQU8sQ0FBQyxVQUFrQixFQUFFLElBQVk7O1lBQ3BELElBQUksRUFBQyxHQUFHLEVBQUUsSUFBSSxFQUFDLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxVQUFVLENBQUMsQ0FBQztZQUM3Qyx1Q0FBdUM7WUFDdkMsT0FBTyxtQkFBUSxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLEdBQUcsRUFBRTtnQkFDdEMsSUFBSSxFQUFFLG1CQUFRLENBQUMsSUFBSSxDQUFDLEdBQUc7Z0JBQ3ZCLE9BQU8sRUFBRSxtQkFBUSxDQUFDLEdBQUcsQ0FBQyxRQUFRO2dCQUM5QixNQUFNLEVBQUUsYUFBYSxDQUFDLElBQUksQ0FBQzthQUMzQixDQUFDLENBQUMsUUFBUSxFQUFFLENBQUE7UUFDZCxDQUFDO0tBQUE7SUFFRCxNQUFNLENBQU8sT0FBTyxDQUFDLFVBQWtCLEVBQUUsSUFBWTs7WUFDcEQsSUFBSSxDQUFDLEVBQUUsRUFBRSxFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQVEsQ0FBQyxHQUFHLElBQUksQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDdkQsSUFBSSxFQUFDLEdBQUcsRUFBQyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsVUFBVSxFQUFFLFFBQVEsQ0FBQyxDQUFDO1lBQ2pELE9BQU8sbUJBQVEsQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxHQUFHLEVBQUU7Z0JBQ3RDLElBQUksRUFBRSxtQkFBUSxDQUFDLElBQUksQ0FBQyxHQUFHO2dCQUN2QixPQUFPLEVBQUUsbUJBQVEsQ0FBQyxHQUFHLENBQUMsUUFBUTtnQkFDOUIsTUFBTSxFQUFFLGFBQWEsQ0FBQyxRQUFRLENBQUM7YUFDL0IsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxtQkFBUSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQTtRQUMvQixDQUFDO0tBQUE7SUFFRCxNQUFNLENBQUMsU0FBUyxDQUFDLFVBQWtCLEVBQUUsVUFBZSxFQUFFO1FBQ3JELElBQUksSUFBSSxHQUFHLE9BQU8sQ0FBQSxDQUFDLENBQUEsbUJBQVEsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQSxDQUFDLENBQUEsbUJBQVEsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxHQUFHLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFDMUYsT0FBTztZQUNOLEdBQUcsRUFBRSxtQkFBUSxDQUFDLE1BQU0sQ0FBQyxVQUFVLEVBQUUsSUFBSSxFQUFFO2dCQUN0QyxPQUFPLEVBQUUsR0FBRyxHQUFHLEVBQUU7Z0JBQ2pCLFVBQVUsRUFBRSxJQUFJO2FBQ2hCLENBQUMsQ0FBQyxRQUFRLENBQUMsbUJBQVEsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDO1lBQzdCLElBQUksRUFBQyxJQUFJLENBQUMsUUFBUSxDQUFDLG1CQUFRLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQztTQUNwQyxDQUFBO0lBQ0YsQ0FBQztJQUVELE1BQU0sQ0FBQyxZQUFZLENBQUMsT0FBYztRQUNqQyxJQUFJLElBQUksR0FBRyxFQUFFLENBQUM7UUFDZCxHQUFFLENBQUM7WUFDRixJQUFJLENBQUMsR0FBRyxRQUFRLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUM7WUFDM0MsSUFBSSxDQUFDLEdBQUcsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7WUFDN0IsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUNiLE9BQU8sR0FBRyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUMsR0FBQyxDQUFDLENBQUMsQ0FBQztRQUMvQixDQUFDLFFBQU0sT0FBTyxDQUFDLE1BQU0sRUFBRTtRQUN2QixPQUFPLElBQUksQ0FBQztRQUNaOzs7VUFHRTtJQUNILENBQUM7SUFFRCxNQUFNLENBQUMsU0FBUyxDQUFDLElBQWE7UUFDN0IsT0FBTyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQSxFQUFFO1lBQ2xCLE9BQU8sQ0FBQyxDQUFDLENBQUMsTUFBTSxHQUFDLEVBQUUsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLEVBQUUsR0FBRyxDQUFDLEdBQUMsQ0FBQyxDQUFDO1FBQ3pDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUNaOzs7bUVBRzJEO0lBQzVELENBQUM7Q0FDRDtBQXhERCx3QkF3REM7QUFFRDs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0VBcUJFIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IENyeXB0b0pTIGZyb20gJ2NyeXB0by1qcyc7XG5cbmNvbnN0IEpzb25Gb3JtYXR0ZXIgPSAocGFzc1NhbHQ6c3RyaW5nKT0+IHtcblx0cmV0dXJuIHtcblx0XHRzdHJpbmdpZnk6IGZ1bmN0aW9uKGNpcGhlclBhcmFtczpDcnlwdG9KUy5saWIuQ2lwaGVyUGFyYW1zKSB7XG5cdFx0XHRsZXQgZGF0YSA9IFtDcnlwdG9KUy5lbmMuSGV4LnN0cmluZ2lmeShjaXBoZXJQYXJhbXMuY2lwaGVydGV4dCldXG5cdFx0XHRpZiAoY2lwaGVyUGFyYW1zLml2KSB7XG5cdFx0XHRcdGRhdGEucHVzaChjaXBoZXJQYXJhbXMuaXYudG9TdHJpbmcoKSk7XG5cdFx0XHR9ZWxzZXtcblx0XHRcdFx0ZGF0YS5wdXNoKFwiXCIpO1xuXHRcdFx0fVxuXHRcdFx0aWYgKGNpcGhlclBhcmFtcy5zYWx0KSB7XG5cdFx0XHRcdGRhdGEucHVzaChjaXBoZXJQYXJhbXMuc2FsdC50b1N0cmluZygpKTtcblx0XHRcdH1lbHNle1xuXHRcdFx0XHRkYXRhLnB1c2goXCJcIik7XG5cdFx0XHR9XG5cdFx0XHRkYXRhLnB1c2gocGFzc1NhbHQpO1xuXG5cdFx0XHRyZXR1cm4gQ3J5cHRvLnRvSGV4Q29kZShkYXRhKTtcblx0XHR9LFxuXHRcdHBhcnNlOiBmdW5jdGlvbihoZXhDb2RlOnN0cmluZyl7XG5cdFx0XHQvL2NvbnNvbGUubG9nKFwiaGV4Q29kZVwiLCBoZXhDb2RlKVxuXHRcdFx0bGV0IFtjdCwgaXYsIHNhbHRdID0gQ3J5cHRvLnBhcnNlSGV4Q29kZShoZXhDb2RlKVxuXG5cdFx0XHRsZXQgY2lwaGVyUGFyYW1zID0gQ3J5cHRvSlMubGliLkNpcGhlclBhcmFtcy5jcmVhdGUoe1xuXHRcdFx0XHRjaXBoZXJ0ZXh0OiBDcnlwdG9KUy5lbmMuSGV4LnBhcnNlKGN0KVxuXHRcdFx0fSk74oCLXG5cdFx0XHRpZiAoaXYpIHtcblx0XHRcdFx0Y2lwaGVyUGFyYW1zLml2ID0gQ3J5cHRvSlMuZW5jLkhleC5wYXJzZShpdik7XG5cdFx0XHR94oCLXG5cdFx0XHRpZiAoc2FsdCkge1xuXHRcdFx0XHRjaXBoZXJQYXJhbXMuc2FsdCA9IENyeXB0b0pTLmVuYy5IZXgucGFyc2Uoc2FsdCk7XG5cdFx0XHR94oCLXG5cdFx0XHRyZXR1cm4gY2lwaGVyUGFyYW1zO1xuXHRcdH1cblx0fVx0XG59O1xuXG5leHBvcnQgY2xhc3MgQ3J5cHRvIHtcblx0c3RhdGljIGFzeW5jIGVuY3J5cHQocGFzc3BocmFzZTogc3RyaW5nLCBkYXRhOiBzdHJpbmcpIHtcblx0XHRsZXQge2tleSwgc2FsdH0gPSB0aGlzLmNyZWF0ZUtleShwYXNzcGhyYXNlKTtcblx0XHQvL2NvbnNvbGUubG9nKFwia2V5LCBzYWx0XCIsIHtrZXksIHNhbHR9KVxuXHRcdHJldHVybiBDcnlwdG9KUy5BRVMuZW5jcnlwdChkYXRhLCBrZXksIHtcblx0XHRcdG1vZGU6IENyeXB0b0pTLm1vZGUuQ0ZCLFxuXHRcdFx0cGFkZGluZzogQ3J5cHRvSlMucGFkLkFuc2lYOTIzLFxuXHRcdFx0Zm9ybWF0OiBKc29uRm9ybWF0dGVyKHNhbHQpXG5cdFx0fSkudG9TdHJpbmcoKVxuXHR9XG5cblx0c3RhdGljIGFzeW5jIGRlY3J5cHQocGFzc3BocmFzZTogc3RyaW5nLCBkYXRhOiBzdHJpbmcpIHtcblx0XHRsZXQgW2N0LCBpdiwgc2FsdCwgcGFzc1NhbHRdID0gdGhpcy5wYXJzZUhleENvZGUoZGF0YSk7XG5cdFx0bGV0IHtrZXl9ID0gdGhpcy5jcmVhdGVLZXkocGFzc3BocmFzZSwgcGFzc1NhbHQpO1xuXHRcdHJldHVybiBDcnlwdG9KUy5BRVMuZGVjcnlwdChkYXRhLCBrZXksIHtcblx0XHRcdG1vZGU6IENyeXB0b0pTLm1vZGUuQ0ZCLFxuXHRcdFx0cGFkZGluZzogQ3J5cHRvSlMucGFkLkFuc2lYOTIzLFxuXHRcdFx0Zm9ybWF0OiBKc29uRm9ybWF0dGVyKHBhc3NTYWx0KVxuXHRcdH0pLnRvU3RyaW5nKENyeXB0b0pTLmVuYy5VdGY4KVxuXHR9XG5cblx0c3RhdGljIGNyZWF0ZUtleShwYXNzcGhyYXNlOiBzdHJpbmcsIHNhbHRTdHI6c3RyaW5nPScnKSB7XG5cdFx0bGV0IHNhbHQgPSBzYWx0U3RyP0NyeXB0b0pTLmVuYy5IZXgucGFyc2Uoc2FsdFN0cik6Q3J5cHRvSlMubGliLldvcmRBcnJheS5yYW5kb20oMTI4IC8gOCk7XG5cdFx0cmV0dXJuIHtcblx0XHRcdGtleTogQ3J5cHRvSlMuUEJLREYyKHBhc3NwaHJhc2UsIHNhbHQsIHtcblx0XHRcdFx0a2V5U2l6ZTogNTEyIC8gMzIsXG5cdFx0XHRcdGl0ZXJhdGlvbnM6IDEwMDBcblx0XHRcdH0pLnRvU3RyaW5nKENyeXB0b0pTLmVuYy5IZXgpLFxuXHRcdFx0c2FsdDpzYWx0LnRvU3RyaW5nKENyeXB0b0pTLmVuYy5IZXgpXG5cdFx0fVxuXHR9XG5cblx0c3RhdGljIHBhcnNlSGV4Q29kZShoZXhDb2RlOnN0cmluZyl7XG5cdFx0bGV0IGRhdGEgPSBbXTtcblx0XHRkb3tcblx0XHRcdGxldCBsID0gcGFyc2VJbnQoaGV4Q29kZS5zdWJzdHIoMCwgNSksIDEwKTtcblx0XHRcdGxldCBjID0gaGV4Q29kZS5zdWJzdHIoNSwgbCk7XG5cdFx0XHRkYXRhLnB1c2goYyk7XG5cdFx0XHRoZXhDb2RlID0gaGV4Q29kZS5zdWJzdHIoNStsKTtcblx0XHR9d2hpbGUoaGV4Q29kZS5sZW5ndGgpO1xuXHRcdHJldHVybiBkYXRhO1xuXHRcdC8qXG5cdFx0bGV0IHdvcmRzID0gQ3J5cHRvSlMuZW5jLkhleC5wYXJzZShoZXhDb2RlKTtcblx0XHRyZXR1cm4gQ3J5cHRvSlMuZW5jLlV0Zjguc3RyaW5naWZ5KHdvcmRzKS5zcGxpdChcIixcIilcblx0XHQqL1xuXHR9XG5cblx0c3RhdGljIHRvSGV4Q29kZShkYXRhOnN0cmluZ1tdKXtcblx0XHRyZXR1cm4gZGF0YS5tYXAoZD0+e1xuXHRcdFx0cmV0dXJuIChkLmxlbmd0aCtcIlwiKS5wYWRTdGFydCg1LCAnMCcpK2Q7XG5cdFx0fSkuam9pbignJyk7XG5cdFx0Lypcblx0XHRsZXQgd29yZHMgPSBDcnlwdG9KUy5lbmMuVXRmOC5wYXJzZShkYXRhLmpvaW4oXCIsXCIpKTtcblx0XHRsZXQgaGV4ID0gQ3J5cHRvSlMuZW5jLkhleC5zdHJpbmdpZnkod29yZHMpO1xuXHRcdC8vY29uc29sZS5sb2coXCJzdHJpbmdpZnk6XCIsIGRhdGEsIFwiPT5cIiwgd29yZHMsIFwiPT5cIiwgaGV4KSovXG5cdH1cbn1cblxuLypcbmNvbnN0IHRlc3QgPSBhc3luYygpPT57XG5cdGNvbnN0IHBhc3MgPSBcIiNkcmZndCBTZiBAMzMgZ2ZkZyBkZmcgZGZnXCI7XG5cdGNvbnN0IGRhdGEgPSBcInJmYXNkc2RzdmZnZmdmZyBkc2ZzZGYgc2RmIHNkZiBzZGZzZGYgc2RmIHNkZiBzZiBzZGdkZmcgZGZnIGRmZyBkZmdmZGdkZiBnc2ZkIGdkZnMgZ3NmZCBnc2ZkIGdkZiBnZmRnZmRnc2RmcmV0ZSByZ2RmIGRmZ2RmZ1wiO1xuXHRsZXQgZW5jcnlwdGVkID0gYXdhaXQgQ3J5cHRvLmVuY3J5cHQocGFzcywgZGF0YSlcblx0LmNhdGNoKChlOmFueSk9Pntcblx0XHRjb25zb2xlLmxvZyhcImVycm9yXCIsIGUpXG5cdH0pXG5cdGNvbnNvbGUubG9nKFwiZW5jcnlwdGVkOlwiLCBlbmNyeXB0ZWQpXG5cdGlmKCFlbmNyeXB0ZWQpXG5cdFx0cmV0dXJuXG5cdGxldCBkZWNyeXB0ZWQgPSBhd2FpdCBDcnlwdG8uZGVjcnlwdChwYXNzLCBlbmNyeXB0ZWQpXG5cdC8vLmNhdGNoKChlOmFueSk9Pntcblx0Ly9cdGNvbnNvbGUubG9nKFwiZXJyb3JcIiwgZSlcblx0Ly99KVxuXHRjb25zb2xlLmxvZyhcImRlY3J5cHRlZDpcIiwgZGVjcnlwdGVkPT1kYXRhLCBkZWNyeXB0ZWQpXG59O1xuXG50ZXN0KCkuY2F0Y2goKGU6YW55KT0+e1xuXHRjb25zb2xlLmxvZyhcImVycm9yXCIsIGUpXG59KVxuKi9cblxuXG5cbiJdfQ==