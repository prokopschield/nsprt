import nsblob, { DirMap } from 'nsblob';
import path from 'path';
import { format } from 'prettier';
import { read, write } from 'serial-async-io';
import Hound, { watch } from 'ts-hound';

export type KnownMap = {
	[filepath: string]: string;
};

function dirmap_to_absolute(root: string, map: DirMap): KnownMap {
	const ret: KnownMap = {};
	for (let [key, value] of Object.entries(map)) {
		key = path.resolve(root, key);
		if (typeof value === 'string') {
			ret[key] = value;
		} else {
			Object.assign(ret, dirmap_to_absolute(key, value));
		}
	}
	return ret;
}

const parserMap: {
	[ext: string]: string;
} = {
	html: 'vue',
	css: 'css',
	js: 'babel',
	ts: 'babel-ts',
	json: 'json',
	md: 'markdown',
};

export function nsprt(directory: string = '.') {
	const watcher = watch(directory);
	const state: {
		dirmap: Promise<DirMap>;
		known: KnownMap;
		watcher: Hound;
		process: Promise<void>;
	} = {
		dirmap: nsblob.store_dir(directory),
		known: {},
		watcher,
		process: new Promise(async (resolve) => {
			await new Promise(setImmediate);
			state.dirmap.then(async (map) => {
				for (const [key, value] of Object.entries(
					dirmap_to_absolute(directory, map)
				)) {
					if (!(key in state.known)) {
						state.known[key] = value;
					}
				}
			});
			watcher.on('change', async (filepath) => {
				try {
					const contents = await read(filepath);
					const hash = await nsblob.store(contents);
					const parser = parserMap[path.extname(filepath).substr(1)];
					if (parser && state.known[filepath] !== hash) {
						const prettied = format(contents.toString(), {
							singleQuote: true,
							useTabs: true,
							parser,
						});
						const newhash = await nsblob.store(prettied);
						if (newhash !== hash) {
							await write(filepath, prettied);
							state.known[filepath] = prettied;
							console.log(
								`Prettied ${path.relative(
									directory,
									filepath
								)} ${newhash.substr(16, 8)}  ❤️`
							);
						}
					}
				} catch (error) {}
			});
		}),
	};
	return state;
}
