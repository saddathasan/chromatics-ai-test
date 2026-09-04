/**
 * The same handlers under Node for tests, so the suite exercises the real HTTP contract
 * rather than calling store functions directly.
 */
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
