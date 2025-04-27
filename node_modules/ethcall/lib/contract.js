"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Represents a deployed contract. Generates a Call per each request.
 * Call generation has a syntax similar to ethers.
 * @example
 * const daiContract = new Contract(daiAddress, erc20Abi);
 * daiContract.balanceOf(address); // returns a Call object
 */
var Contract = /** @class */ (function () {
    /**
     * Create a contract.
     * @param address Address of the contract
     * @param abi ABI of the contract
     */
    function Contract(address, abi) {
        Object.defineProperty(this, "address", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "abi", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "functions", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.address = address;
        this.abi = abi;
        this.functions = abi.filter(function (x) { return x.type === 'function'; });
        var callFunctions = this.functions.filter(function (x) { return x.stateMutability === 'pure' || x.stateMutability === 'view'; });
        for (var _i = 0, callFunctions_1 = callFunctions; _i < callFunctions_1.length; _i++) {
            var callFunction = callFunctions_1[_i];
            var name_1 = callFunction.name;
            if (!name_1) {
                continue;
            }
            var getCall = makeCallFunction(this, name_1);
            if (!this[name_1]) {
                Object.defineProperty(this, name_1, {
                    enumerable: true,
                    value: getCall,
                    writable: false,
                });
            }
        }
    }
    return Contract;
}());
function makeCallFunction(contract, name) {
    return function () {
        var params = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            params[_i] = arguments[_i];
        }
        var address = contract.address;
        var func = contract.functions.find(function (f) { return f.name === name; });
        var inputs = (func === null || func === void 0 ? void 0 : func.inputs) || [];
        var outputs = (func === null || func === void 0 ? void 0 : func.outputs) || [];
        return {
            contract: {
                address: address,
            },
            name: name,
            inputs: inputs,
            outputs: outputs,
            params: params,
        };
    };
}
exports.default = Contract;
//# sourceMappingURL=contract.js.map