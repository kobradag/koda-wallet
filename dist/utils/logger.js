"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateLogger = exports.FlowLogger = exports.log = void 0;
const flow_logger_1 = require("@aspectron/flow-logger");
Object.defineProperty(exports, "FlowLogger", { enumerable: true, get: function () { return flow_logger_1.FlowLogger; } });
let custom = ['utxo:cyan', 'utxodebug:cyan', 'tx:green', 'txdebug:green'];
const logger = new flow_logger_1.FlowLogger('Kaspa Wallet', {
    display: ['name', 'level', 'time'],
    custom,
    color: ['level']
});
logger.enable('all');
exports.log = logger;
const CreateLogger = (name = "KaspaWallet") => {
    let logger = new flow_logger_1.FlowLogger(name, {
        display: ['name', 'level', 'time'],
        custom,
        color: ['level']
    });
    return logger;
};
exports.CreateLogger = CreateLogger;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibG9nZ2VyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vdXRpbHMvbG9nZ2VyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLHdEQUFrRDtBQWExQywyRkFiQSx3QkFBVSxPQWFBO0FBWGxCLElBQUksTUFBTSxHQUFHLENBQUMsV0FBVyxFQUFFLGdCQUFnQixFQUFFLFVBQVUsRUFBRSxlQUFlLENBQUMsQ0FBQTtBQUN6RSxNQUFNLE1BQU0sR0FBRyxJQUFJLHdCQUFVLENBQUMsY0FBYyxFQUFFO0lBQzdDLE9BQU8sRUFBRyxDQUFDLE1BQU0sRUFBRSxPQUFPLEVBQUUsTUFBTSxDQUFDO0lBQ25DLE1BQU07SUFDTixLQUFLLEVBQUUsQ0FBQyxPQUFPLENBQUM7Q0FDaEIsQ0FBQyxDQUFDO0FBRUgsTUFBTSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQztBQUdSLFFBQUEsR0FBRyxHQUFHLE1BQU0sQ0FBQztBQUVuQixNQUFNLFlBQVksR0FBRyxDQUFDLE9BQVksYUFBYSxFQUFVLEVBQUU7SUFDakUsSUFBSSxNQUFNLEdBQUcsSUFBSSx3QkFBVSxDQUFDLElBQUksRUFBRTtRQUNqQyxPQUFPLEVBQUcsQ0FBQyxNQUFNLEVBQUUsT0FBTyxFQUFFLE1BQU0sQ0FBQztRQUNuQyxNQUFNO1FBQ04sS0FBSyxFQUFFLENBQUMsT0FBTyxDQUFDO0tBQ2hCLENBQUMsQ0FBQztJQUNILE9BQU8sTUFBTSxDQUFDO0FBQ2YsQ0FBQyxDQUFBO0FBUFksUUFBQSxZQUFZLGdCQU94QiIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7Rmxvd0xvZ2dlcn0gZnJvbSAnQGFzcGVjdHJvbi9mbG93LWxvZ2dlcic7XG5cbmxldCBjdXN0b20gPSBbJ3V0eG86Y3lhbicsICd1dHhvZGVidWc6Y3lhbicsICd0eDpncmVlbicsICd0eGRlYnVnOmdyZWVuJ11cbmNvbnN0IGxvZ2dlciA9IG5ldyBGbG93TG9nZ2VyKCdLYXNwYSBXYWxsZXQnLCB7IFxuXHRkaXNwbGF5IDogWyduYW1lJywgJ2xldmVsJywgJ3RpbWUnXSwgXG5cdGN1c3RvbSwgXG5cdGNvbG9yOiBbJ2xldmVsJ11cbn0pO1xuXG5sb2dnZXIuZW5hYmxlKCdhbGwnKTtcblxuZXhwb3J0IHR5cGUgTG9nZ2VyID0gdHlwZW9mIGxvZ2dlcjsgLy9UT0RPIGZpbmQgaG93IHRvIGV4cG9ydCB0eXBlIGZyb20gbW9kdWxlXG5leHBvcnQgY29uc3QgbG9nID0gbG9nZ2VyO1xuZXhwb3J0IHtGbG93TG9nZ2VyfTtcbmV4cG9ydCBjb25zdCBDcmVhdGVMb2dnZXIgPSAobmFtZTpzdHJpbmc9XCJLYXNwYVdhbGxldFwiKSA6IExvZ2dlcj0+e1xuXHRsZXQgbG9nZ2VyID0gbmV3IEZsb3dMb2dnZXIobmFtZSwgeyBcblx0XHRkaXNwbGF5IDogWyduYW1lJywgJ2xldmVsJywgJ3RpbWUnXSwgXG5cdFx0Y3VzdG9tLCBcblx0XHRjb2xvcjogWydsZXZlbCddXG5cdH0pO1xuXHRyZXR1cm4gbG9nZ2VyO1xufVxuIl19