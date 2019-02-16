declare type Resolve<T> = (val?: T) => void;
declare type Reject = (val?: any) => void;
declare type Revealing<T> = (resolve: Resolve<T>, reject: Reject) => void;
declare type Fulfilled<T> = (val?: T) => any;
declare type Rejected = (val?: any) => any;
declare const _status: unique symbol;
declare const _value: unique symbol;
declare const _subs: unique symbol;
export declare class MPromise<T> {
    private [_status];
    private [_value]?;
    private [_subs];
    constructor(revealing?: Revealing<T>);
    private static [_resolve];
    static resolve(x: any): MPromise<any>;
    static reject(x: any): MPromise<any>;
    private [setValueAndStatus];
    private [_depend];
    private [_notify];
    then(onFulfilled?: Fulfilled<T>, onRejected?: Rejected): MPromise<any>;
}
export declare const resolve: typeof MPromise.[_resolve];
export declare function reject(promise: MPromise<any>, reason: any): void;
export {};
//# sourceMappingURL=index.d.ts.map