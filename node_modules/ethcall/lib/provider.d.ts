import { Provider as EthersProvider } from '@ethersproject/providers';
import { Call } from './call';
import { Multicall } from './multicall';
declare type CallType = 'BASIC' | 'TRY_ALL' | 'TRY_EACH';
declare type BlockTag = number | 'latest' | 'pending';
/**
 * Represents a Multicall provider. Used to execute multiple Calls.
 */
declare class Provider {
    provider?: EthersProvider;
    multicall: Multicall | null;
    multicall2: Multicall | null;
    multicall3: Multicall | null;
    /**
     * Create a provider.
     */
    constructor();
    /**
     * Initialize the provider. Should be called once before making any requests.
     * @param provider ethers provider
     */
    init(provider: EthersProvider): Promise<void>;
    /**
     * Make one call to the multicall contract to retrieve eth balance of the given address.
     * @param address Address of the account you want to look up
     * @returns Ether balance fetching call
     */
    getEthBalance(address: string): Call;
    /**
     * Aggregate multiple calls into one call.
     * Reverts when any of the calls fails.
     * For ignoring the success of each call, use {@link tryAll} instead.
     * @param calls Array of Call objects containing information about each read call
     * @param block Block number for this call
     * @returns List of fetched data
     */
    all<T>(calls: Call[], block?: BlockTag): Promise<T[]>;
    /**
     * Aggregate multiple calls into one call.
     * If any of the calls fail, it returns a null value in place of the failed call's return data.
     * @param calls Array of Call objects containing information about each read call
     * @param block Block number for this call
     * @returns List of fetched data. Failed calls will result in null values.
     */
    tryAll<T>(calls: Call[], block?: BlockTag): Promise<(T | null)[]>;
    /**
     * Aggregates multiple calls into one call.
     * If any of the calls that are allowed to fail do fail,
     * it returns a null value in place of the failed call's return data.
     * @param calls Array of Call objects containing information about each read call
     * @param canFail Array of booleans specifying whether each call can fail
     * @param block Block number for this call
     * @returns List of fetched data. Failed calls will result in null values.
     */
    tryEach<T>(calls: Call[], canFail: boolean[], block?: BlockTag): Promise<(T | null)[]>;
    getContract(call: CallType, block?: BlockTag): Multicall | null;
    isAvailable(multicall: Multicall | null, block?: BlockTag): boolean;
}
export default Provider;
export type { BlockTag };
//# sourceMappingURL=provider.d.ts.map