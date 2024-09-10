import { createLogger } from '@lvksh/logger';
import nsblob, { DirMap } from 'nsblob';
import path from 'path';
import { format } from 'prettier';
import { delay } from 'ps-std';
import { read, write } from 'serial-async-io';
import Hound, { watch } from 'ts-hound';
import Config from './config';

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
	vue: 'vue',
	html: 'vue',
	css: 'css',
	js: 'babel',
	ts: 'babel-ts',
	json: 'json',
	md: 'markdown',
};

/**
 * Begin prettying directory
 * @param directory directory to prettify
 * @param logFn passed to \@lvksh\/logger
 * @returns the prettier's internal state
 */
export function nsprt(
	directory: string = '.',
	logFn: (input: string) => void = console.log
) {
	const config = new Config(directory, '.');
	const logger = createLogger(
		{
			prettied: 'Prettied',
			error: 'ERROR',
		},
		undefined,
		(line) => logFn(String(line))
	);
	const watcher = watch(directory);
	const state: {
		config: Config;
		logger: typeof logger;
		dirmap: Promise<DirMap>;
		known: KnownMap;
		watcher: Hound;
		process: Promise<void>;
	} = {
		config,
		logger,
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
					const parser = parserMap[path.extname(filepath).slice(1)];
					if (parser && state.known[filepath] !== hash) {
						const prettied = format(contents.toString(), {
							singleQuote: true,
							useTabs: true,
							tabWidth: 4,
							...config,
							parser,
						});
						const newhash = await nsblob.store(prettied);
						if (newhash !== hash) {
							await delay(300);

							if ((await nsblob.store_file(filepath)) !== hash) {
								// file has been modified
								return;
							}

							await write(filepath, prettied);
							state.known[filepath] = prettied;
							logger.prettied(
								`${path.relative(
									directory,
									filepath
								)} ${newhash.slice(16, 24)}  ❤️`
							);
						}
					}
				} catch (error) {}
			});
		}),
	};
	return state;
}
