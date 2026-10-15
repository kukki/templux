import {startProjectWeb} from '@templux/web/server';
await startProjectWeb(new URL('.',import.meta.url).pathname);
