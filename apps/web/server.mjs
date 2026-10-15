import {fileURLToPath} from 'node:url';
import {startProjectWeb} from './project-server.mjs';
try{await startProjectWeb(fileURLToPath(new URL('.',import.meta.url)));}catch{process.exitCode=1;}
