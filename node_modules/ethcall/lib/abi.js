"use strict";
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
var abi_coder_1 = require("abi-coder");
var Abi = /** @class */ (function () {
    function Abi() {
    }
    Object.defineProperty(Abi, "encode", {
        enumerable: false,
        configurable: true,
        writable: true,
        value: function (name, jsonInputs, params) {
            var inputs = backfillParamNames(jsonInputs).params;
            var abi = [
                {
                    type: 'function',
                    name: name,
                    inputs: inputs,
                },
            ];
            var coder = new abi_coder_1.Coder(abi);
            var valueMap = Object.fromEntries(inputs.map(function (input, index) { return [input.name, params[index]]; }));
            return coder.encodeFunction(name, valueMap);
        }
    });
    Object.defineProperty(Abi, "encodeConstructor", {
        enumerable: false,
        configurable: true,
        writable: true,
        value: function (jsonInputs, params) {
            var inputs = backfillParamNames(jsonInputs).params;
            var abi = [
                {
                    type: 'constructor',
                    inputs: inputs,
                },
            ];
            var coder = new abi_coder_1.Coder(abi);
            var valueMap = Object.fromEntries(inputs.map(function (input, index) { return [input.name, params[index]]; }));
            return coder.encodeConstructor(valueMap);
        }
    });
    Object.defineProperty(Abi, "decode", {
        enumerable: false,
        configurable: true,
        writable: true,
        value: function (name, jsonOutputs, data) {
            var _a = backfillParamNames(jsonOutputs), outputs = _a.params, generated = _a.generated;
            var abi = [
                {
                    type: 'function',
                    name: name,
                    outputs: outputs,
                },
            ];
            var coder = new abi_coder_1.Coder(abi);
            var functionOutput = coder.decodeFunctionOutput(name, data);
            var result = outputs.map(function (output) { return functionOutput.values[output.name || '']; });
            for (var _i = 0, _b = Object.entries(functionOutput.values); _i < _b.length; _i++) {
                var _c = _b[_i], name_1 = _c[0], value = _c[1];
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                var key = name_1;
                // Skip generated names for clarity
                if (generated.has(name_1)) {
                    continue;
                }
                // Don't overwrite existing keys
                if (result[key]) {
                    continue;
                }
                result[key] = value;
            }
            return result;
        }
    });
    return Abi;
}());
// ABI doesn't enforce to specify param names
// However, abi-coder requires names to parse the params.
// Therefore, we "patch" the ABI by assigning unique param names.
function backfillParamNames(jsonParams) {
    var names = new (Set.bind.apply(Set, __spreadArray([void 0], jsonParams.map(function (param) { return param.name; }), false)))();
    var generated = new Set();
    var params = jsonParams.map(function (param) {
        var originalName = param.name, indexed = param.indexed, type = param.type, components = param.components;
        var name = originalName ? originalName : generateUniqueName(names);
        names.add(name);
        if (!originalName) {
            generated.add(name);
        }
        return {
            name: name,
            indexed: indexed,
            type: type,
            components: components,
        };
    });
    return {
        params: params,
        generated: generated,
    };
}
function generateUniqueName(names) {
    var i = 0;
    while (names.has(i.toString())) {
        i++;
    }
    return "param-".concat(Math.random().toString().substring(2));
}
exports.default = Abi;
//# sourceMappingURL=abi.js.map