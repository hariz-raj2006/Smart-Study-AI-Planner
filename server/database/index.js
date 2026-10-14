import { config } from '../config.js';
import { createStore } from './jsonStore.js';

/** The single shared store used by the whole backend. */
export const store = createStore(config.databasePath);