"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var call_1 = require("./call");
var calls_1 = __importDefault(require("./calls"));
var multicall_1 = require("./multicall");
var DEFAULT_CHAIN_ID = 1;
/**
 * Represents a Multicall provider. Used to execute multiple Calls.
 */
var Provider = /** @class */ (function () {
    /**
     * Create a provider.
     */
    function Provider() {
        Object.defineProperty(this, "provider", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "multicall", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "multicall2", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "multicall3", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.multicall = (0, multicall_1.getMulticall)(DEFAULT_CHAIN_ID);
        this.multicall2 = (0, multicall_1.getMulticall2)(DEFAULT_CHAIN_ID);
        this.multicall3 = (0, multicall_1.getMulticall3)(DEFAULT_CHAIN_ID);
    }
    /**
     * Initialize the provider. Should be called once before making any requests.
     * @param provider ethers provider
     */
    Object.defineProperty(Provider.prototype, "init", {
        enumerable: false,
        configurable: true,
        writable: true,
        value: function (provider) {
            return __awaiter(this, void 0, void 0, function () {
                var network;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            this.provider = provider;
                            return [4 /*yield*/, provider.getNetwork()];
                        case 1:
                            network = _a.sent();
                            this.multicall = (0, multicall_1.getMulticall)(network.chainId);
                            this.multicall2 = (0, multicall_1.getMulticall2)(network.chainId);
                            this.multicall3 = (0, multicall_1.getMulticall3)(network.chainId);
                            return [2 /*return*/];
                    }
                });
            });
        }
    });
    /**
     * Make one call to the multicall contract to retrieve eth balance of the given address.
     * @param address Address of the account you want to look up
     * @returns Ether balance fetching call
     */
    Object.defineProperty(Provider.prototype, "getEthBalance", {
        enumerable: false,
        configurable: true,
        writable: true,
        value: function (address) {
            var multicall = this.multicall || this.multicall2 || this.multicall3;
            if (!multicall) {
                throw Error('Multicall contract is not available on this network.');
            }
            return (0, calls_1.default)(address, multicall.address);
        }
    });
    /**
     * Aggregate multiple calls into one call.
     * Reverts when any of the calls fails.
     * For ignoring the success of each call, use {@link tryAll} instead.
     * @param calls Array of Call objects containing information about each read call
     * @param block Block number for this call
     * @returns List of fetched data
     */
    Object.defineProperty(Provider.prototype, "all", {
        enumerable: false,
        configurable: true,
        writable: true,
        value: function (calls, block) {
            return __awaiter(this, void 0, void 0, function () {
                var multicall, provider;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            if (!this.provider) {
                                throw Error('Provider should be initialized before use.');
                            }
                            multicall = this.getContract('BASIC', block);
                            if (!multicall) {
                                console.warn('Multicall contract is not available on this network, using deployless version.');
                            }
                            provider = this.provider;
                            return [4 /*yield*/, (0, call_1.all)(provider, multicall, calls, block)];
                        case 1: return [2 /*return*/, _a.sent()];
                    }
                });
            });
        }
    });
    /**
     * Aggregate multiple calls into one call.
     * If any of the calls fail, it returns a null value in place of the failed call's return data.
     * @param calls Array of Call objects containing information about each read call
     * @param block Block number for this call
     * @returns List of fetched data. Failed calls will result in null values.
     */
    Object.defineProperty(Provider.prototype, "tryAll", {
        enumerable: false,
        configurable: true,
        writable: true,
        value: function (calls, block) {
            return __awaiter(this, void 0, void 0, function () {
                var multicall, provider;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            if (!this.provider) {
                                throw Error('Provider should be initialized before use.');
                            }
                            multicall = this.getContract('TRY_ALL', block);
                            if (!multicall) {
                                console.warn('Multicall2 contract is not available on this network, using deployless version.');
                            }
                            provider = this.provider;
                            return [4 /*yield*/, (0, call_1.tryAll)(provider, multicall, calls, block)];
                        case 1: return [2 /*return*/, _a.sent()];
                    }
                });
            });
        }
    });
    /**
     * Aggregates multiple calls into one call.
     * If any of the calls that are allowed to fail do fail,
     * it returns a null value in place of the failed call's return data.
     * @param calls Array of Call objects containing information about each read call
     * @param canFail Array of booleans specifying whether each call can fail
     * @param block Block number for this call
     * @returns List of fetched data. Failed calls will result in null values.
     */
    Object.defineProperty(Provider.prototype, "tryEach", {
        enumerable: false,
        configurable: true,
        writable: true,
        value: function (calls, canFail, block) {
            return __awaiter(this, void 0, void 0, function () {
                var multicall, provider, failableCalls;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            if (!this.provider) {
                                throw Error('Provider should be initialized before use.');
                            }
                            multicall = this.getContract('TRY_EACH', block);
                            if (!multicall) {
                                console.warn('Multicall3 contract is not available on this network, using deployless version.');
                            }
                            provider = this.provider;
                            failableCalls = calls.map(function (call, index) {
                                return __assign(__assign({}, call), { canFail: canFail[index] });
                            });
                            return [4 /*yield*/, (0, call_1.tryEach)(provider, multicall, failableCalls, block)];
                        case 1: return [2 /*return*/, _a.sent()];
                    }
                });
            });
        }
    });
    Object.defineProperty(Provider.prototype, "getContract", {
        enumerable: false,
        configurable: true,
        writable: true,
        value: function (call, block) {
            var multicall = this.isAvailable(this.multicall, block)
                ? this.multicall
                : null;
            var multicall2 = this.isAvailable(this.multicall2, block)
                ? this.multicall2
                : null;
            var multicall3 = this.isAvailable(this.multicall3, block)
                ? this.multicall3
                : null;
            switch (call) {
                case 'BASIC':
                    return multicall3 || multicall2 || multicall;
                case 'TRY_ALL':
                    return multicall3 || multicall2;
                case 'TRY_EACH':
                    return multicall3;
            }
        }
    });
    Object.defineProperty(Provider.prototype, "isAvailable", {
        enumerable: false,
        configurable: true,
        writable: true,
        value: function (multicall, block) {
            if (!multicall) {
                return false;
            }
            if (!block) {
                return true;
            }
            if (block === 'latest' || block === 'pending') {
                return true;
            }
            return multicall.block < block;
        }
    });
    return Provider;
}());
exports.default = Provider;
//# sourceMappingURL=provider.js.map