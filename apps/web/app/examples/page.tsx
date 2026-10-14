import {connection} from 'next/server';import {notFound} from 'next/navigation';
import {projectFeatures} from '../../../../shared/features.mjs';import {presentation} from '../../../../shared/presentation.mjs';
import {profile} from '../components/session';import SessionGuard from '../components/session-guard';import Unavailable from '../components/unavailable';import ProjectShell from '../components/project-shell';
import ExampleLab from './lab';import copy from '../../../../config/examples-copy.json';import './examples.css';
export default async function ExamplesPage(){
 await connection();if(!projectFeatures().componentExamples)notFound();
 const config=presentation(),account=await profile(true);if(!account)return <Unavailable config={config} href="/examples"/>;
 return <ProjectShell config={config}><SessionGuard seconds={account.heartbeatSeconds} accountId={account.id} version={account.authVersion}/><h1>{copy.title}</h1><p className="intro">{copy.intro}</p><ExampleLab elements={config.elements}/><div className="auth-actions"><a className="text-link" href="/account">{copy.account}</a></div></ProjectShell>;
}
