#!/usr/bin/env node

import { nsprt } from '.';

nsprt();

process.on('uncaughtException', (e: Error) => {
	console.error(`An error has occured: ${e.message}`);
});
