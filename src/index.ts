/* global DEBUG */
type Resolve<T> = (val?: T) => void;
type Reject = (val?: any) => void;
type Revealing<T> = (resolve: Resolve<T>, reject: Reject) => void;
type Fulfilled<T> = (val?: T) => any;
type Rejected = (val?: any) => any;
type Sub = (status: PStatus) => void;

// 2.1 一个 promise 的当前状态必须是以下三个中的一个: pending, fulfilled, rejected.
const enum PStatus {
	pending,
	fulfilled,
	rejected
}

const _status = Symbol('status');
const _value = Symbol('value');
const _subs = Symbol('subs');
const _notify = Symbol('notify');
const _depend = Symbol('depend');
const _resolve = Symbol('resolve');
const setValueAndStatus = Symbol('setValueAndStatus');

function runAsync(fn: () => void) {
	if (process && process.nextTick) {
		process.nextTick(fn);
	} else {
		// 浏览器环境下为了省事, 就不搞microtask了
		setTimeout(fn, 0);
	}
}

export class MPromise<T> {
	private [_status]: PStatus;
	private [_value]?: T;
	private [_subs]: Sub[];

	// 可以没有揭示函数, 那promise就永远pending
	constructor(revealing?: Revealing<T>) {
		// 除了初始化不用setValueAndStatus, 避免触发notify
		this[_value] = undefined;
		this[_status] = PStatus.pending;
		this[_subs] = [];

		if (revealing) {
			let called = false;
			const resolve_: Resolve<T> = val => {
				if (called) {
					return;
				}
				called = true;
				MPromise[_resolve](this, val);
			};
			const reject_: Reject = val => {
				if (called) {
					return;
				}
				called = true;
				this[setValueAndStatus](val, PStatus.rejected);
			};
			try {
				revealing(resolve_, reject_);
			} catch (err) {
				if (!called) {
					this[setValueAndStatus](err, PStatus.rejected);
				}
			}
		}
	}

	// [[Resolve(promise x)]]
	// 就拿onFulfilled返回promise这一种情况来讲, 返回的这个promise的值类型
	// 由用户决定, 甚至运行时根据不同情况返回不同类型的值, 所以这里x的值应
	// 当是any, 而promise的值也一样, 在Promise.resolve的时候就不知道会是什么
	// 类型, 所以也是any
	private static [_resolve](promise: MPromise<any>, x: any): void {
		// 虽然setValueAndStatus中实际上对状态进行了控制, 不过这里还是判断一下
		// 避免意外
		if (promise[_status] !== PStatus.pending) {
			return;
		}
		// 2.3.1. 如果 `promise` 和 `x` 指向同一个对象, 则将 `promise` 置为 rejected, 并用一个 `TypeError` 作为 reason
		if (promise === x) {
			promise[setValueAndStatus](new TypeError('promise is same as x'), PStatus.rejected);
			// 2.3.2. 如果 `x` 是一个 promise, 则 `promise` 采用 `x` 的状态
		} else if (x instanceof MPromise) {
			// 如果x是pending, 则将x添加为promise的依赖
			// 2.3.2.1. 如果 `x` 是 pending 状态, 则 `promise` 必须保持 pending 状态
			// 直到 `x` 变为 fulfilled 或 rejected (之后 `promise` 的状态也跟着变为相应状态).
			if (x[_status] === PStatus.pending) {
				x[_depend](status => {
					promise[setValueAndStatus](x[_value], status);
				});
			} else {
				// 否则直接修改promise的状态和值
				// 2.3.2.2. 如果/当 `x` 是 fulfilled 状态, 则将 `promise` 置为 fulfilled 状态, 并具有和 `x` 一样的 value.
				// 2.3.2.3. 如果/当 `x` 是 rejected 状态, 则将 `promise` 置为 rejected 状态, 并具有和 `x` 一样的 reason.
				promise[setValueAndStatus](x[_value], x[_status]);
			}
			// 2.3.3. 否则, 如果 `x` 是一个对象或函数
		} else if (Object.prototype.toString.call(x) === '[object Object]' || typeof x === 'function') {
			let then = null;
			try {
				// 2.3.3.1. 令 `then` 为 `x.then`, 即将 `x.then` 赋值给一个临时变量 `then`
				then = x.then;
			} catch (err) {
				// 2.3.3.2. 如果取 `x.then` 时抛出了一个异常 `e`, 则将 `promise` 置为 rejected, 并用 `e` 作为它的 reason
				promise[setValueAndStatus](err, PStatus.rejected);
				return;
			}
			// 2.3.3.3. 如果 `then` 是一个函数, 则调用它并用 `x` 作为它的 `this`, 给它传递两个回调函数作为参数, 第一个参数是 `resolvePromise`, 第二个参数是 `rejectPromise`,
			if (typeof then === 'function') {
				// 2.3.3.3.3. 如果 `resolvePromise` 和 `rejectPromise` 都被调用了,
				// 或多次以相同的参数调用了, 则采用第一次被调用的那个函数(采用应该是指只对第一次的调用按照上面两步的操作执行), 之后的调用都被忽略
				// 这个called作为被调用的标记
				let called = false;
				const resolvePromise: Fulfilled<any> = y => {
					if (called) {
						return;
					}
					called = true;
					// 3.6 检测循环thenalbe
					if (x === y) {
						promise[setValueAndStatus](new TypeError('cycle thenable'), PStatus.rejected);
						return;
					}
					// 2.3.3.3.1. 如果/当 `resolvePromise` 被传入参数 `y` 调用时, 则执行 `[[Resolve]](promise, y)`
					MPromise[_resolve](promise, y);
				};
				const rejectPromise: Rejected = r => {
					if (called) {
						return;
					}
					called = true;
					// 2.3.3.3.2. 如果/当 `rejectPromise` 被传入参数 `r` 调用时, `r` 是一个 reason, 则将 `promise` 置为 rejected, 并用 `r` 作为它的 reason
					promise[setValueAndStatus](r, PStatus.rejected);
				};
				try {
					// 2.3.3.3.4. 如果调用 `then` 抛出了一个异常 `e`.
					then.call(x, resolvePromise, rejectPromise);
				} catch (err) {
					// 2.3.3.3.4.1. 如果 `resolvePromise` 或 `rejectPromise` 已经被调用过了, 则忽略它
					if (!called) {
						// 2.3.3.3.4.2. 否则将 `promise` 置为 rejected, 并用 `e` 作为其 reason
						promise[setValueAndStatus](err, PStatus.rejected);
					}
				}
			} else {
				// 2.3.3.4. 如果 `then` 不是一个函数, 则将 `promise` 置为 fulfilled, 并用 `x` 作为其 value
				promise[setValueAndStatus](x, PStatus.fulfilled);
			}
		} else {
			// 2.3.4. 如果 `x` 不是一个对象或函数, 则将 `promise` 置为 fulfilled, 并用 `x` 作为其 value
			promise[setValueAndStatus](x, PStatus.fulfilled);
		}
	}

	// 讲道理这里x应该可以有个确定的类型, 但是当x
	// 是一个promise的时候, 我不知道怎么把promise的值的类型
	// 映射到返回值的类型...
	public static resolve(x: any): MPromise<any> {
		if (x instanceof MPromise) {
			return x;
		} else {
			return new MPromise<typeof x>(rs => rs(x));
		}
	}

	public static reject(x: any) {
		if (x instanceof MPromise) {
			return x;
		} else {
			return new MPromise<typeof x>((rs, rj) => rj(x));
		}
	}

	// 状态和value总是一起改变的, 所以通过统一的私有方法进行设置便于管理
	private [setValueAndStatus](value: T | undefined, status: PStatus) {
		// 2.1 的约束
		// 2.1.1 当处于 pending 状态时, 一个 promise 可以转移到 fulfilled 或 rejected 状态
		// 2.1.2 and 2.1.3的约束也在这里
		if (this[_status] === PStatus.pending) {
			this[_value] = value;
			this[_status] = status;
			// 2.2.2.2. 它一定不能在 `promise` 状态为 fulfilled 之前被调用
			// 2.2.3.2. 它一定不能在 `promise` 状态为 rejected 之前被调用
			// notify是异步的, 这也确保了2.2.4
			// 2.2.4. `onFulfilled` 或 `onRejected` 只有在执行上下文([execution context](https://es5.github.io/#x10.3))栈中仅剩平台代码时才会被调用
			this[_notify]();
		}
	}

	private [_depend](cb: Sub): void {
		this[_subs].push(cb);
	}

	private [_notify](): void {
		runAsync(() => {
			while (this[_subs].length) {
				// 2.2.2.3. 它最多被调用一次
				// 2.2.3.3. 它最多被调用一次
				// 2.2.6.1. 如果/当 `promise` 的状态是 fulfilled, 其相应的所有 `onFulfilled` 回调函数必须按照它们通过 `then` 注册的顺序依次调用执行
				// 2.2.6.2. 如果/当 `promise` 的状态是 rejected, 其相应的所有 `onRejected` 回调函数必须按照它们通过 `then` 注册的顺序依次调用执行
				// 因为callback中会判断自身状态是fulfilled还是rejected,
				// 从而根据情况执行onFulfilled和onRejected, 所以这里只
				// 需要一个数组就行, 不需要两个, 也避免了需要处理当已经
				// 是最终状态时候, 还得清空掉另一个状态的队列的情况, 避免
				// 内存泄漏
				(<Sub>this[_subs].shift())(this[_status]);
			}
		});
	}

	// 2.2.1 `onFulfilled` 和 `onRejected` 都是可选的
	// 所以then可以没有onFulfilled也可以没有onRejected
	// onFulfilled参数的类型需要和Promise的值的类型保持一致
	// onRejected参数的类型则没必要一致, 因为可能是Error
	// then的返回值是个Promise, 但是Promise的值由onFulfilled的返回值决定
	// 而onFulfilled可以返回任意类型, 所以这里应当是一个any类型的Promise
	public then(onFulfilled?: Fulfilled<T>, onRejected?: Rejected): MPromise<any> {
		// 2.2.7. `then` 方法必须返回一个 promise
		// 3.3 通常返回一个新promise
		return new MPromise<any>((rs, rj) => {
			// 管他当前Promise是什么状态, 先把自己作为依赖
			// 它可能被Promise链后面的Promise依赖, 也可能被自己依赖
			// 收集依赖异步调用onFulfilled和onRejected
			// 本质上讲, promise每调用一次then注册callback, 就导致promise自身被依赖一次
			// 2.2.2.1. 则它必须在 `promise` 状态为 fulfilled 之后被调用, 它的第一个参数是 `promise` 的 value
			// 2.2.3.1. 则它必须在 `promise` 状态为 rejected 之后被调用, 它的第一个参数是 `promise` 的 reason
			this[_depend](status => {
				if (status === PStatus.fulfilled) {
					// 2.2.1.1 如果 `onFulfilled` 不是一个函数, 则它必须被忽略
					// 2.2.2 如果 `onFulfilled` 是一个函数
					if (typeof onFulfilled === 'function') {
						try {
							// 2.2.7.1. 如果 `onFulfilled` 或 `onRejected` 返回一个 value `x`,
							// 则运行 Promise 解析处理程序(Promise Resolution Procedure) `[[Resolve]](promise2, x)`
							// 隐含了一个事情是then中需要拿到onFulfilled的返回值
							// 那就要求onFulfilled和onRejected必须在then的作用域中被调用
							// 同时它还得是异步的
							// 我只能想到这样的方式
							// 2.2.2.1. 则它必须在 `promise` 状态为 fulfilled 之后被调用, 它的第一个参数是 `promise` 的 value
							// 2.2.5. `onFulfilled` 和 `onRejected` 必须被作为函数调用(即没有 `this`, 也不是作为构造函数调用)
							const rst = onFulfilled.call(undefined, this[_value]);
							// 注意rs包装了[[Resolve(promise, x)]]
							rs(rst);
						} catch (err) {
							// 2.2.7.2. 如果 `onFulfilled` 或 `onRejected` 抛出了一个异常 `e`, `promise2` 必须转移到 rejected 状态, 并且将 `e` 作为 reason
							rj(err);
						}
					} else {
						// 2.2.7.3. 如果 `onFulfilled` 不是一个函数并且 `promise1` 是 fulfilled 状态,
						// 则 `promise2` 必须是 fulfilled 状态, 并且它的 value 和 promise1 一样
						rs(this[_value]);
					}
				} else {
					// 2.2.1.2 如果 `onRejected` 不是一个函数, 则它必须被忽略
					// 2.2.3 如果 `onRejected` 是一个函数
					if (typeof onRejected === 'function') {
						try {
							const rst = onRejected.call(undefined, this[_value]);
							// 2.2.7.1. 如果 `onFulfilled` 或 `onRejected` 返回一个 value `x`,
							// 则运行 Promise 解析处理程序(Promise Resolution Procedure) `[[Resolve]](promise2, x)`
							rs(rst);
						} catch (err) {
							rj(err);
						}
					} else {
						// 2.2.7.4. 如果 `onRejected` 不是一个函数并且 `promise1` 是 rejected 状态,
						// 则 `promise2` 必须是 rejected 状态, 并且它的 reason 和 `promise1` 一样
						rj(this[_value]);
					}
				}
			});
			// 如果不是pending, 就立即通知还在队列中未执行的onFulfilled或onRejected
			if (this[_status] !== PStatus.pending) {
				this[_notify]();
			}
		});
	}
}

// 为了跑测试暴露出来
export const resolve = MPromise[_resolve];

// 为了跑测试暴露出来
export function reject(promise: MPromise<any>, reason: any) {
	promise[setValueAndStatus](reason, PStatus.rejected);
}
