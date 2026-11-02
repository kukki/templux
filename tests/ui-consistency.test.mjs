import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(`apps/web/app/${path}`,'utf8');

test('shared design tokens drive page spacing and typography',()=>{
  const css=read('style.css');
  for(const token of ['--page-gutter','--page-padding-block','--content-max','--font-xs','--font-sm','--font-md','--font-body','--font-h3','--font-h2','--font-brand']){
    assert.match(css,new RegExp(`${token}\\s*:`),`${token} must be declared in the shared stylesheet`);
  }
  assert.match(css,/header, footer \{[^}]*padding: 20px var\(--page-gutter\)/);
  assert.match(css,/main \{[^}]*padding: var\(--page-padding-block\) var\(--page-gutter\)/);
});

test('signed-out and signed-in shells share the horizontal gutter',()=>{
  const shell=read('style.css'),navigation=read('components/navigation.css');
  assert.match(shell,/header, footer \{[^}]*var\(--page-gutter\)/);
  assert.match(navigation,/\.application-header\{[^}]*var\(--page-gutter\)/);
  assert.match(navigation,/\.application-workspace>main\{[^}]*padding:var\(--page-padding-block\) var\(--page-gutter\)/);
  assert.match(navigation,/\.application-shell>footer\{[^}]*var\(--page-gutter\)/);
});

test('floating panel heading rules cannot restyle page and account panels',()=>{
  const css=read('components/elements/overlays.css');
  assert.doesNotMatch(css,/(?:^|})\s*\.panel-heading\s*\{/, 'floating panel headings must be scoped');
  assert.match(css,/\.floating-panel \.panel-heading\{/);
  assert.match(css,/\.floating-panel \.panel-heading h2\{/);
  assert.match(css,/\.floating-panel \.panel-body\{/);
});

test('unified search input fills the 44px control height after label padding and border',()=>{
  const css=read('components/elements/elements.css');
  assert.match(css,/\.unified-search label\{[^}]*padding:\.35rem \.8rem/);
  assert.match(css,/\.unified-search input\{[^}]*min-height:calc\(var\(--control-h\) - \.7rem - 2px\)/);
});
