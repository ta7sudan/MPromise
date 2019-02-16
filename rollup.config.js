import babel from 'rollup-plugin-babel';
import replace from 'rollup-plugin-replace';
import minify from 'rollup-plugin-babel-minify';
import { relative } from 'path';
import { browser, module, main, name, version, license, author, homepage } from './package.json';

/**
 * 如果用babel-minify压缩的话, banner字符串的开头和结尾谜之不能换行
 * 不过有一点好的是, 用rollup的banner字段和babel-minify的banner字段都可以
 * uglify的话则需要自己处理下注释
 */
const banner = `/**
 * @Version ${version}
 * @Author: ${author}
 * @Repo: ${homepage}
 * @License: ${license}
 */`;

export default [
	{
		input: 'src/index.js',
		plugins: [
			replace({
				DEBUG: JSON.stringify(false)
			}),
			babel({
				exclude: 'node_modules/**'
			})
		],
		treeshake: {
			propertyReadSideEffects: false
		},
		output: [
			{
				file: module,
				format: 'esm',
				sourcemap: true
			},
			{
				name,
				file: browser,
				format: 'umd',
				sourcemap: true
			}
		]
	},
	{
		input: 'src/index.js',
		plugins: [
			replace({
				DEBUG: JSON.stringify(false)
			}),
			babel({
				exclude: 'node_modules/**'
			}),
			minify({
				comments: false
			})
		],
		treeshake: {
			propertyReadSideEffects: false
		},
		output: [
			{
				name,
				banner,
				file: 'dist/MPromise.min.js',
				format: 'umd',
				sourcemap: true,
				// sourcemap生成之后在devtools本来看到的文件是src/index.js, 这个选项可以变成MPromise.js
				sourcemapPathTransform: path => ~path.indexOf('index') ? 'MPromise.js' : relative('src', path)
			},
			{
				banner,
				file: main,
				format: 'cjs',
				sourcemap: true
			}
		]
	}
];
