import fs from 'fs';
import JSON5 from 'json5';
import YAML from 'js-yaml';
import path from 'path';
import TOML from 'toml';

const locations: {
	[name: string]: {
		fn: (place: string) => unknown;
		places: string[];
	};
} = {
	pkg: {
		fn: (place: string) => require(place).prettier,
		places: ['package.json'],
	},
	req: {
		fn: require,
		places: [
			'.prettierrc',
			'.prettierrc.js',
			'.prettierrc.cjs',
			'prettier.config.js',
			'prettier.config.cjs',
		],
	},
	json: {
		fn: (file: string) => JSON5.parse(fs.readFileSync(file, 'utf-8')),
		places: ['.prettierrc', '.prettierrc.json', '.prettierrc.json5'],
	},
	yaml: {
		fn: (file: string) => YAML.load(fs.readFileSync(file, 'utf-8')),
		places: ['.prettierrc', '.prettierrc.yaml', '.prettierrc.yml'],
	},
	toml: {
		fn: (file: string) => TOML.parse(fs.readFileSync(file, 'utf-8')),
		places: ['.prettierrc', '.prettierrc.toml'],
	},
};

const locations_arr = Object.values(locations);

interface Field {
	[k: keyof any]: object | string | number;
}

interface Config extends Field {}

class Config {
	constructor(...files: string[]) {
		for (const file of files) {
			if (this.look(file)) {
				break;
			}
		}
	}
	look(loc: string): boolean {
		loc = path.resolve(loc);
		if (!fs.existsSync(loc)) {
			return false;
		}
		const stat = fs.statSync(loc);
		if (stat.isDirectory()) {
			for (const { fn, places } of locations_arr) {
				for (const place of places) {
					if (this.attempt(fn, path.resolve(loc, place))) {
						return true;
					}
				}
			}
		} else {
			for (const { fn } of locations_arr) {
				this.attempt(fn, loc);
			}
		}
		if (path.resolve('/') === loc) {
			return false;
		} else return this.look(path.resolve(loc, '..'));
	}
	attempt(fn: (file: string) => unknown, file: string): boolean {
		try {
			if (!fs.existsSync(file)) {
				return false;
			}
			const val = fn(file);
			if (typeof val === 'object') {
				Object.assign(this, val);
				return true;
			} else {
				return false;
			}
		} catch (error) {
			return false;
		}
	}
}

export = Config;
