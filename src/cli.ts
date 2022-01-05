#!/usr/bin/env node

import { nsprt } from '.';

const state = nsprt();

process.on('uncaughtException', (e: Error) => {
	state.logger.error(e.message);
});
