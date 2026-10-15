import test from 'node:test';import assert from 'node:assert/strict';
import {createProjectApplication} from '../apps/api/dist/project-interface.js';
test('project interface rejects core paths, wildcards, missing permissions and duplicates before application creation',async()=>{
 for(const routes of [[{method:'GET',path:'/api/auth/session',permission:'application:read',handle:()=>({})}],[{method:'GET',path:'/api/business/*',permission:'application:read',handle:()=>({})}],[{method:'GET',path:'/api/business/data',handle:()=>({})}],[{method:'DELETE',path:'/api/business/data',permission:'application:read',handle:()=>({})}],Array(2).fill({method:'GET',path:'/api/business/data',permission:'application:read',handle:()=>({})})])await assert.rejects(createProjectApplication(null,{routes}),/业务路由/);
});
test('unknown project permission is rejected before a route can be exposed',async()=>{await assert.rejects(createProjectApplication(null,{routes:[{method:'GET',path:'/api/business/unknown',permission:'unknown:read',handle:()=>({})}]}),/业务路由/);});
