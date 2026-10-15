'use client';
// Synthetic project-owned page. No authentication transport or business data.
import ProjectCopy from './project-copy';
export default function Page(){return <main style={{maxWidth:720,margin:'2rem auto',padding:24}}><h1>Harbor dispatch workbench</h1><p>Project-owned synthetic reference, not a shared business feature.</p><p>Reference: HARBOR-DEMO-0042</p><ProjectCopy value=" HARBOR-DEMO-0042 " messages={{action:'Copy reference',pending:'Copying reference',succeeded:'Reference copied',retry:'Try copy again',denied:'Copy permission was denied'}}/></main>;}
