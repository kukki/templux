# Ubuntu：如何测试域名入口与环境校验

仅在你授权的**全新隔离UAT测试项目目录**执行；不要把现用项目或生产目录当演练目标。Ubuntu版本/架构仍需记录实测，下面不是“已通过”声明。宿主只需Docker/Compose和基础Shell；Node/数据库工具在容器。

## 1. 确认来源与现有入口

使用含#31/#32实现的源码或准确的新消费候选；旧T29/正式0.1包没有这些功能，不能只覆盖其Compose。候选来源见[验收](../discovery/domain-environment-acceptance.md)。记录：

```sh
cat /etc/os-release
uname -m
docker version --format '{{.Client.Version}} / {{.Server.Version}}'
docker compose version
```

Compose需要2.24.4+，Traefik已有`websecure`和适用证书。按实际值替换以下公开配置，**不要猜用示例域名或网络**：

```sh
export TEMPLUX_PROJECT_NAME=templux-sandbox-uat
export DEPLOYMENT_ENV=UAT
export DOMAIN_NAME=example.com
export APP_HOST=templux-sandbox-uat.example.com
export NETWORK_NAME=your-existing-traefik-network
export TRAEFIK_CONTAINER=your-existing-traefik-container

docker network inspect "$NETWORK_NAME" --format '{{.Name}}'
docker inspect "$TRAEFIK_CONTAINER" --format '{{range $name, $net := .NetworkSettings.Networks}}{{printf "%s %s\n" $name $net.IPAddress}}{{end}}'
```

预期：外部网络已存在，Traefik在该网络有明确IP；不新建/改动Traefik或网络。只看上面网络/IP元数据，不打印整个inspect或个人.env。取匹配网络的精确IPv4：

```sh
PROXY_IP=$(docker inspect "$TRAEFIK_CONTAINER" --format '{{range $name, $net := .NetworkSettings.Networks}}{{printf "%s %s\n" $name $net.IPAddress}}{{end}}' | awk -v target="$NETWORK_NAME" '$1 == target {print $2}')
test -n "$PROXY_IP" || exit 1
export ENTRY_TRUSTED_PROXY_CIDRS="$PROXY_IP/32"
```

IPv6-only需独立核对`.GlobalIPv6Address`并填写单IP/128。不要填整个共享网络或0.0.0.0/0。代理容器重建改IP后重做此核对。DNS应让APP_HOST指向已有Ubuntu公网入口；UAT/PROD及每个新项目用不同Compose项目名和Host。

## 2. 在新目录生成受限.env（不回显密码）

确认没有既有.env。下面只生成当前测试项目配置，随机数据库密码留在0600文件；Feishu关闭，其余可选空值保留：

```sh
umask 077
docker run --rm -i --user "$(id -u):$(id -g)" \
  -e TEMPLUX_PROJECT_NAME -e DEPLOYMENT_ENV -e DOMAIN_NAME -e APP_HOST \
  -e NETWORK_NAME -e ENTRY_TRUSTED_PROXY_CIDRS \
  -v "$PWD:/project" -w /project node:24.21.0-bookworm-slim node --input-type=module <<'JS'
import {readFileSync,writeFileSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
let text=readFileSync('.env.example','utf8');
const password=randomBytes(24).toString('hex');
const values={...Object.fromEntries(['TEMPLUX_PROJECT_NAME','DEPLOYMENT_ENV','DOMAIN_NAME','APP_HOST','NETWORK_NAME','ENTRY_TRUSTED_PROXY_CIDRS'].map(k=>[k,process.env[k]])),APP_PUBLIC_URL:'https://'+process.env.APP_HOST,TEMPLUX_DB_PASSWORD:password,DATABASE_URL:'postgresql://templux:'+password+'@database:5432/templux'};
for(const [key,value] of Object.entries(values)){
 if(!value)throw new Error('missing '+key);
 text=text.replace(new RegExp('^'+key+'=.*$','m'),()=>key+'='+value);
}
writeFileSync('.env',text,{flag:'wx',mode:0o600});
console.log('Created .env (values hidden)');
JS
./templux env-check --json
./templux env-list --json
```

预期：exit0、单JSON `ok:true`；Feishu等可选键为空仍通过。只有键/状态/来源，无数据库密码、secret值。已有.env会拒覆盖；外部数据库改用已授权现存库URL，不能用此脚本覆盖真实连接。仅使用密码链路时保持Feishu全部空；启用时按[合同](domain-and-environment.md)完整配置和回调，真人组织验证仍另行本人授权。

## 3. 先测空白拒启，再启动

仍在全新项目、尚未启动业务时：

```sh
cp -p .env .env.test-backup
sed -i "s|^APP_PUBLIC_URL=.*|APP_PUBLIC_URL='   '|" .env
env -u APP_PUBLIC_URL ./templux env-check --json
env -u APP_PUBLIC_URL docker compose -f compose.yaml up --build -d api
docker compose -f compose.yaml ps -q api
mv .env.test-backup .env
./templux env-check --json
./templux start --json
```

前两条校验/启动预期**非零**，必填`APP_PUBLIC_URL:required_nonblank`，最后`ps -q api`应无业务容器；不要用`set -e`让预期失败中断恢复步骤。清除宿主同名变量是为了不让shell覆盖测试文件中的空白。恢复后校验及start应exit0，返回HTTPS公开URL；不要手工先启动API绕过迁移。审计/容量等configured项显式空仍按既定合同拒绝，和真正可空optional区别见合同。

## 4. 域名/TLS与维护检查

不用宿主curl，利用同一Node镜像校验证书和HTTP；**不要加TLS跳过参数**：

```sh
docker run --rm -e APP_HOST node:24.21.0-bookworm-slim node --input-type=module -e 'const r=await fetch("https://"+process.env.APP_HOST+"/health/live"); console.log(r.status,await r.text());process.exit(r.status===200?0:1)'
docker run --rm -e APP_HOST node:24.21.0-bookworm-slim node --input-type=module -e 'const r=await fetch("https://"+process.env.APP_HOST+"/login"); console.log(r.status);process.exit(r.status===200?0:1)'
docker compose -f compose.yaml ps
```

预期：健康/登录页200；没有本项目API/entry新增宿主端口映射。证书/DNS失败应先由入口维护者核对，不关闭证书验证或替换已有Traefik。通过网页登录仅使用你明确授权的隔离账号；密码/Agent权限/Feishu初始化沿既有CLI合同，不给真人自动授权。

维护演练会暂停**当前隔离测试项目**业务：

```sh
maintenance_version() {
  ./templux maintenance-status --json | docker run --rm -i node:24.21.0-bookworm-slim node --input-type=module -e 'let s="";for await(const c of process.stdin)s+=c;console.log(JSON.parse(s).state.version)'
}
./templux maintenance-halt --expected-version "$(maintenance_version)" --confirm --json
docker run --rm -e APP_HOST node:24.21.0-bookworm-slim node --input-type=module -e 'const r=await fetch("https://"+process.env.APP_HOST+"/");console.log(r.status);process.exit(r.status===503?0:1)'
docker run --rm -e APP_HOST node:24.21.0-bookworm-slim node --input-type=module -e 'const r=await fetch("https://"+process.env.APP_HOST+"/health/live");console.log(r.status);process.exit(r.status===200?0:1)'
./templux maintenance-resume --expected-version "$(maintenance_version)" --confirm --json
```

预期：停服后同域名503维护页、健康仍200，恢复后登录页200。默认计时提醒不会自动停服；不要用普通stop全停来期待仍有维护页。

## 5. 新项目、记录与清理

另一项目从准确新候选创建独立目录，使用自己的`TEMPLUX_PROJECT_NAME`、`APP_HOST`和数据库，重复1–4；共享NETWORK_NAME不代表共享会话或授权。两个Host应显示各自品牌，未知Host由已有Traefik规则决定（自有隔离测试是404），不能借本指南保证用户全局catch-all行为。

留存：实际Ubuntu版本/架构、源码或manifest及包SHA、Docker/Compose版本、公开Host/服务名、命令退出和HTTP状态、空白拒启/清单脱敏结果。不要收集.env、密码文件、Cookie或整份Compose环境dump。完成后仅清理本次自有项目容器/卷/测试账号/备份/受限配置；删除卷前确认项目名及数据确属可丢弃演练，不清理共享网络/Traefik、不prune全局cache。

执行这些步骤仍需你的真实环境结果；目前仅macOS自有容器集成通过，不将此指南当Ubuntu/wildcardTLS/真人Feishu验收。
