import typescript from 'rollup-plugin-typescript2';
import babel from 'rollup-plugin-babel';
import replace from 'rollup-plugin-replace';
import { relative } from 'path';
import { name } from './package.json';

export default {
	input: 'src/index.ts',
	plugins: [
		replace({
			DEBUG: JSON.stringify(true)
		}),
		typescript({
			tsconfig: 'tsconfig.json',
			useTsconfigDeclarationDir: true
		}),
		babel({
			exclude: 'node_modules/**'
		})
	],
	treeshake: {
		propertyReadSideEffects: false
	},
	output:
	{
		name,
		file: 'example/scripts/MPromise.umd.js',
		format: 'umd',
		sourcemap: true,
		sourcemapPathTransform: path => ~path.indexOf('index') ? 'MPromise.js' : relative('src', path)
	}
};
