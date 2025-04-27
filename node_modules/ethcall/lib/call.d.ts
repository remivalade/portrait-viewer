import { JsonFragmentType } from '@ethersproject/abi';
import { BaseProvider } from '@ethersproject/providers';
import { Params } from './abi';
import { Multicall } from './multicall';
import { BlockTag } from './provider';
interface Call {
    contract: {
        address: string;
    };
    name: string;
    inputs: readonly JsonFragmentType[];
    outputs: readonly JsonFragmentType[];
    params: Params;
}
interface FailableCall extends Call {
    canFail: boolean;
}
interface CallResult {
    success: boolean;
    returnData: string;
}
declare function all<T>(provider: BaseProvider, multicall: Multicall | null, calls: Call[], block?: BlockTag): Promise<T[]>;
declare function tryAll<T>(provider: BaseProvider, multicall2: Multicall | null, calls: Call[], block?: BlockTag): Promise<(T | null)[]>;
declare function tryEach<T>(provider: BaseProvider, multicall3: Multicall | null, calls: FailableCall[], block?: BlockTag): Promise<(T | null)[]>;
export { Call, CallResult, all, tryAll, tryEach };
//# sourceMappingURL=call.d.ts.map