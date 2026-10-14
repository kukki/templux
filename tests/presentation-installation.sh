#!/bin/sh
# Real, isolated copy/start/restart acceptance. Requires only Docker, Compose and shell.
set -eu
T02_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
mkdir -p "$T02_ROOT/test-results"
T02_COPY=$(mktemp -d "$T02_ROOT/test-results/t02-project.XXXXXX")
T02_NAME="templux-t02-$(date +%s)-$$"
export TEMPLUX_PROJECT_NAME="$T02_NAME" TEMPLUX_HTTP_PORT=31010 TEMPLUX_API_PORT=31810
cleanup() {
  docker compose --project-directory "$T02_COPY" -f "$T02_COPY/compose.yaml" down -v --remove-orphans >&2 || true
  if [ "${T02_KEEP_COPY:-0}" != 1 ]; then rm -rf "$T02_COPY"; fi
}
trap cleanup EXIT HUP INT TERM
# No .env, source-project data, Git history, or previous acceptance artifacts are copied.
tar -C "$T02_ROOT" --exclude='./.git' --exclude='./node_modules' --exclude='./test-results' --exclude='./.env' --exclude='*/node_modules' --exclude='*/.next' --exclude='*/dist' -cf - . | tar -C "$T02_COPY" -xf -
printf '%s\n' "$T02_COPY" > "$T02_ROOT/test-results/t02-copy-path.txt"
"$T02_COPY/templux" init --name '复制验收项目' --brand '新项目品牌' --theme dark-brown --version 2.3.4 --copyright '© 新项目' --overwrite --confirm --non-interactive --json
"$T02_COPY/templux" config-check --non-interactive --json
cat > "$T02_COPY/apps/web/public/project-logo.svg" <<'SVG'
<svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 34 34"><circle cx="17" cy="17" r="15" fill="#e5b482"/></svg>
SVG
sed 's/"logo": ""/"logo": "\/project-logo.svg"/' "$T02_COPY/config/presentation.json" > "$T02_COPY/config/presentation.next"
mv "$T02_COPY/config/presentation.next" "$T02_COPY/config/presentation.json"
"$T02_COPY/templux" start --non-interactive --json
compose() { docker compose --project-directory "$T02_COPY" -f "$T02_COPY/compose.yaml" "$@"; }
compose build checks >&2
# Pass scripts as arguments because one-off checks run without stdin by default.
compose run --rm --no-deps checks node --input-type=module -e '
import assert from "node:assert/strict";
const api=await (await fetch("http://api:8080/api/status")).json();
assert.equal(api.name,"复制验收项目"); assert.equal(api.version,"2.3.4");
const html=await (await fetch("http://web:3000")).text();
for(const text of ["新项目品牌","© 新项目","#211913","2.3.4"]) assert.ok(html.includes(text),text);
assert.ok(html.includes("/project-logo.svg"));
assert.equal((await fetch("http://web:3000/project-logo.svg")).status,200);
assert.match(html, /<time[^>]+dateTime=/); assert.doesNotMatch(html,/DATABASE_URL|postgresql:\/\//);
console.log("Copied project: real API, brand, palette, copyright and time PASS");'
# Capture the image identity; configuration changes must not invoke a rebuild.
T02_API_IMAGE=$(compose images -q api)
T02_WEB_IMAGE=$(compose images -q web)
compose run --rm --no-deps -v "$T02_COPY/config:/acceptance-config:rw" checks node --input-type=module -e '
import {readFileSync,writeFileSync} from "node:fs";
const path="/acceptance-config/presentation.json";
const config=JSON.parse(readFileSync(path));
config.project.name="重启后新名称"; config.brand.wordmark="替换品牌";
config.header.note="项目专属页头"; config.footer.text="项目专属页脚";
config.copy.heading="重启即生效的项目文案"; config.language="en-GB";
config.time.timeZone="UTC"; config.time.showSeconds=false;
writeFileSync(path,JSON.stringify(config));'
compose run --rm --no-deps checks node --input-type=module -e '
import assert from "node:assert/strict";
assert.equal((await (await fetch("http://api:8080/api/status")).json()).name,"复制验收项目");
assert.ok((await (await fetch("http://web:3000")).text()).includes("新项目品牌"));
console.log("Configuration remains a restart boundary PASS");'
compose restart api web >&2
compose up -d --wait --wait-timeout 60 api web >&2
[ "$T02_API_IMAGE" = "$(compose images -q api)" ]
[ "$T02_WEB_IMAGE" = "$(compose images -q web)" ]
printf 'Restart retained API image %s and Web image %s\n' "$T02_API_IMAGE" "$T02_WEB_IMAGE"
compose run --rm --no-deps checks node --input-type=module -e '
import assert from "node:assert/strict";
assert.equal((await (await fetch("http://api:8080/api/status")).json()).name,"重启后新名称");
const html=await (await fetch("http://web:3000")).text();
for(const text of ["替换品牌","项目专属页头","项目专属页脚","重启即生效的项目文案","lang=\"en-GB\""]) assert.ok(html.includes(text),text);
assert.match(html, /<time[^>]*>\d{2}\/\d{2}\/\d{4}, \d{2}:\d{2}<\/time>/);
console.log("Same images after restart: replacement copy, locale, timezone and minute precision PASS");'
compose run --rm --no-deps -v "$T02_COPY/config:/acceptance-config:rw" checks node --input-type=module -e '
import {readFileSync,writeFileSync} from "node:fs";
const path="/acceptance-config/presentation.json"; const config=JSON.parse(readFileSync(path));
config.header.visible=false; config.footer.visible=false; writeFileSync(path,JSON.stringify(config));'
compose restart api web >&2
compose up -d --wait --wait-timeout 60 api web >&2
compose run --rm --no-deps checks node --input-type=module -e '
import assert from "node:assert/strict";
const html=await (await fetch("http://web:3000")).text();
assert.doesNotMatch(html, /<header|<footer/); assert.ok(html.includes("重启即生效的项目文案"));
console.log("Hidden header and footer PASS");'
# Real process startup rejects invalid config instead of silently falling back.
compose run --rm --no-deps -v "$T02_COPY/config:/acceptance-config:rw" checks node --input-type=module -e '
import {writeFileSync} from "node:fs"; writeFileSync("/acceptance-config/presentation.json","{invalid-json");'
if compose run --rm --no-deps api; then
  printf '%s\n' 'Invalid API startup unexpectedly succeeded' >&2; exit 1
fi
if "$T02_COPY/templux" start --non-interactive --json; then
  printf '%s\n' 'Invalid project start unexpectedly succeeded' >&2; exit 1
fi
printf '%s\n' 'Isolated copy, restart and invalid startup acceptance PASS'
