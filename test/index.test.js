const { MPromise, reject: _reject, resolve: _resolve } = require('../dist/MPromise.cjs');
const promisesAplusTests = require('promises-aplus-tests');

const adapter = {
	resolved(val) {
		return new MPromise((rs, rj) => rs(val));
	},
	rejected(reason) {
		return new MPromise((rs, rj) => rj(reason));
	},
	deferred() {
		const promise = new MPromise();
		function resolve(val) {
			_resolve(promise, val);
		}
		function reject(val) {
			_reject(promise, val);
		}
		return {
			promise,
			resolve,
			reject
		};
	}
};

promisesAplusTests(adapter, function (err) {
	// All done; output is in the console. Or check `err` for number of failures.
	if (err) {
		console.log(err);
	}
});