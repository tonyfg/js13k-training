import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import closure from 'rollup-plugin-closure-compiler';
import copy from 'rollup-plugin-copy';
import eslint from 'rollup-plugin-eslint';

// `npm run build` -> `production` is true
// `npm run dev` -> `production` is false
const production = !process.env.ROLLUP_WATCH;

export default {
	entry: 'src/index.js',
	dest: 'public/bundle.js',
	format: 'iife', // immediately-invoked function expression — suitable for <script> tags
	plugins: [
    eslint(),
    copy({ 'static': 'public' }),
		resolve(), // tells Rollup how to find stuff in node_modules
		commonjs(), // converts commonjs modules to ES modules
		production && closure({
      compilationLevel: 'ADVANCED',
      warningLevel: 'QUIET'
    })
	],
	sourceMap: true
};
