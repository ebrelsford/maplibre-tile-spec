import typescript from '@rollup/plugin-typescript';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import nodePolyfills from 'rollup-plugin-polyfill-node';

export default {
	input: 'bench/decodeInBrowser.ts',
	output: [
		{
			file: 'bench/bundle.js',
			format: 'iife'
		}
	],
    plugins: [
        typescript(),
        nodeResolve(),
        nodePolyfills()
    ]
};
