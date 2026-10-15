// TEST ONLY: patch a disposable /opt/templux source inside the tooling container.
// Never changes released 0.1.0 or the host checkout.
import {readFileSync,writeFileSync} from 'node:fs';
const root='/opt/templux',config=JSON.parse(readFileSync(root+'/release.config.json'));config.version='0.2.0-t26.1';config.upgradeFrom=['0.1.0'];writeFileSync(root+'/release.config.json',JSON.stringify(config));
const source=root+'/apps/api/src/project-interface.ts',compiled=root+'/apps/api/dist/project-interface.js';
const extra='\nexport function sharedReleaseLabel(){return "t26-isolated-target";}\n';
for(const p of [source,compiled])writeFileSync(p,readFileSync(p,'utf8')+extra);
writeFileSync(root+'/apps/api/dist/project-interface.d.ts',readFileSync(root+'/apps/api/dist/project-interface.d.ts','utf8')+'\nexport declare function sharedReleaseLabel(): string;\n');
// This new skeleton tool makes the target export a real build requirement.
writeFileSync(root+'/project-template/tools/shared-version-check.mjs','import {sharedReleaseLabel} from "@templux/core";\nif(sharedReleaseLabel()!=="t26-isolated-target")throw new Error("Shared target interface mismatch");\n');
const docker=root+'/project-template/Dockerfile';writeFileSync(docker,readFileSync(docker,'utf8').replace('FROM dependencies AS api-build\n','FROM dependencies AS api-build\nRUN node tools/shared-version-check.mjs\n').replace('FROM dependencies AS web-build\n','FROM dependencies AS web-build\nRUN node .templux/verify.mjs . --installed\n'));
// A genuine client-visible package asset change, also synthetic/test-only.
writeFileSync(root+'/apps/web/public/t26-release.svg','<svg xmlns="http://www.w3.org/2000/svg" width="160" height="24"><text x="0" y="18">T26 test target</text></svg>\n');
const {spawnSync}=await import('node:child_process');const result=spawnSync('node',['tools/release/build.mjs','/release'],{cwd:root,stdio:'inherit'});process.exitCode=result.status??1;
