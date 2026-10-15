# T29 默认冷安装有界补验

## 范围与结论

任务 `01a14095-cd41-7780-a375-46922fcdb60b`，工程基线 `8f055e3acc7fac8e5da43ac622ae2ecf81059711`。2026-10-16 在同一 macOS Docker Desktop 环境，仅对自有新项目副本诊断。

**本次准确候选的默认 Compose management 与 Web 冷依赖构建均实际成功。** 未修改产品、候选、Dockerfile、Compose、网络、代理、默认 builder 或全局配置；无 host network、预制业务镜像、预填 npm cache、额外权限或外部凭据。不能据此确定此前长挂的根因，也不保证网络永不失败。冷安装项是否关闭交 TL 独立复核。

#30 / 父 #1 仍开放；Linux 宿主、WSL2 及本人授权的真实 Feishu 组织验收仍未执行。Docker Desktop 的 Linux VM 不是 Linux 宿主验收。没有新跑 SQL、浏览器、517 或其它业务矩阵。

## 来源与默认路径

实际来源为已审本机候选 `test-results/t29/releases/0.1.2-t29.1/project`；产品来源 commit `c02ac42859b7140a5e76f7b4126b18973bbdd84f`。不是历史 0.1.0、.2/.3 overlay 或修改过网络的旧消费者。

| 文件 | SHA256 |
| --- | --- |
| Dockerfile | `a39eb85836a9f0741c4cff06fea9815680c8892a6ce0ec78ee2611a32c2bae7f` |
| compose.yaml | `94d144148023fea3fdd60c24c80570d3d17faeb3c38ccdef892e0f705b2b45c3` |
| package-lock.json | `cbc901ed75f8bc09afa4f723b20388ebe1ab5f4a4bd587a121d6dba36b825dda` |
| templux.lock.json | `a1e0b4b09b6fc99f6ddb1549282afb2a6255cbd8b3cabae08cdbb44cd0477ae4` |
| manifest.json | `de067a89e34f10a482286d7d8b330e9522ab7ad7bb1c7d751c9c9317d6f13878` |
| delivery.json（保持原值） | `3928db76aee723b9b16d839b3d1579c38b797d2dc8b56316ca7bf1e2ad63f237` |

独占副本 `/Users/jkoo/git/templux-t29-cold-t2y9bs4x/project`，无 .env、个人 npm 配置、凭据、构建产物或 node_modules。逐文件 SHA/mode 对照见 `input-inventory.json` / `cold-proof.json`，候选与副本构建前后均不变。`--env-file /dev/null` 明确不加载部署秘密。

读取 Compose 后仅保存 build 路由字段，不保存全配置。management 位于 tools profile，直接指定该服务可构建；实际原始构建日志记录其目标。默认 api/entry/web 的有效 build 仅 context、Dockerfile、target，无 network/build args/image 覆盖。没有添加 Compose override。

## 环境、假设与诊断

`environment.json` 仅白名单元数据：Docker 29.8.2，context / current builder `desktop-linux`，driver `docker`，BuildKit v0.33.1，Linux arm64 VM，overlayfs。builder 列表的 worker network 标签为 `host`，**不等于命令使用 `--network=host`**；两次命令均未传 network，使用标准默认 RUN 网络。

Engine 有 HttpProxy / HttpsProxy / NoProxy 配置（仅记录存在性），宿主进程无 HTTP_PROXY/HTTPS_PROXY/ALL_PROXY/NO_PROXY，Docker client 无 proxy profiles。没有读取或输出 auths、token、.npmrc、代理凭据。小探针 RUN 中三项代理环境均不存在；DNS 为 `192.168.65.7`，registry 解析 `198.18.9.232`。不据此推断具体 VPN / 代理软件或历史故障原因。

测试前的有界假设与结果：

1. 默认构建网络 DNS/TLS/代理转发异常：本次默认 DNS、metadata GET、tarball 完整 body 读取均成功；无法回溯历史时点。
2. npm fetch 失败/重试：旧日志默认 notice 级只有前置 verifier 成功，无法定位具体请求。当前冷 npm ci 完成，生产日志有实际 fetch / cache miss。
3. 旧并发构建或 executor 瞬时状态：本次串行、无旧自有 build 客户端；未复现，不足确认历史并发因果。
4. 生命周期或编译慢：Dockerfile 原命令已有 `--ignore-scripts`，长挂位置在 npm ci 而非 tsc/Next；本次完整编译亦成功。

旧四类证据原文保留：`consumer-management-observed-build.log`（取消，不是通过）、`consumer-cold-install-diagnostic.log`（普通 Node 同锁 94 包 5s）、`consumer-management-host-network.log`、`consumer-init-host-network.stderr` / `consumer-init-final.stderr`（Bake host entitlement 拒绝）。旧默认尝试超过240秒的取消也早于 npm 默认单请求300000ms期限，不能单凭静默断言永久死锁。没有绕过 host entitlement 或把该路径作为本次通过。

## 实际命令与结果

所有新证据在 `test-results/t29-cold-install/`。命令数组、实际退出、单调时钟耗时、上限见各 `.json`，完整 plain 日志见对应 `.log`。

| 运行 | 上限 | 实测 / exit | 实际覆盖 |
| --- | --- | --- | --- |
| `docker build --no-cache --progress=plain PROBE` | 40s | 3.625s / 0 | 默认 DNS，registry metadata 31,430,680 bytes / 815ms，Next tarball 43,630,586 bytes / 2326ms |
| `docker compose --env-file /dev/null -p t29-cold-default --progress plain build --no-cache management` | 150s | 10.702s / 0 | 原 Dockerfile dependencies 94包约6s，API tsc，生产API依赖63包982ms，PG/CLI装配及镜像导出 |
| 同上，服务 `web` | 150s | 27.305s / 0 | 再执行 dependencies 94包约6s，Web生产依赖24包约7s，Next16.4构建/10静态页及导出 |

management 输出镜像 `sha256:9512013190597c3b0e0b95cb81e6e778ffe7aeb0db552f9e71105c52890b5d84`；Web `sha256:299f5403b288a5f0451b21adb5b036f1407823cb8e6f1f6594a550587646c05f`。没有启动这些产品镜像的业务入口。

### 冷依赖证据及可观测边界

- 官方 Node 基础镜像控制：`/root/.npm` 和 `/opt/project` 均不存在，Node v24.21.0；未准备带依赖镜像。
- 副本逐文件 inventory，无 node_modules/.npm/.next；原 Dockerfile 无 `--mount` 或 cache mount，也没有复制宿主 npm cache。
- 两次 `--no-cache` 日志均显示完整 dependencies npm ci **实际执行并新增94包**；不是 RUN cache hit。management/API生产 npm ci 和 Web生产 npm ci 也分别执行。
- management 原 npm debug 日志聚合：61 条 `cache miss`、62 条 HTTP GET 200，public registry host 62条。`cacheHits=62` 是整份 debug 文本的命中短语计数，不能与 miss 当作互斥请求分类或据此推断所有依赖命中。日志只提取聚合数，未公开原始调试日志。
- Web 镜像默认用户 node 无法观察 `/root/.npm/_logs`，聚合为0是**不可见，不是没有请求或零缓存**；Web重新取依赖的证据为独立基础层、空本地缓存、无mount及实际npm ci，而非该聚合。
- Node/Postgres/Docker官方基础镜像和 WORKDIR 层可缓存，单列允许；未声称基础镜像冷拉取。registry/CDN/Engine透明网络路径可能有服务端缓存，无法保证源站物理读取每字节；本次证明项目本地 npm 依赖冷安装，不冒称互联网无缓存。
- 没有注入 npm registry/proxy配置，未创建新 builder；因此这两次确实是用户当前默认 builder/默认网络，不是特殊新 builder 替代。

## 文档核对与复跑

使用 Context7 resolve → query：Docker Buildx `/docker/buildx` 的 create/inspect/driver/默认network；Compose `/docker/compose` 的 build/no-cache/--builder/global progress；npm `/npm/cli` 的 ci/ignore-scripts/http logging/fetch重试。官方依据：

- [Buildx build](https://github.com/docker/buildx/blob/master/docs/reference/buildx_build.md)：RUN network默认default，builder可显式覆盖。
- [Compose build](https://github.com/docker/compose/blob/main/docs/reference/compose_build.md)：`--no-cache`/`--builder`；本次没有后者。
- [npm config defaults](https://github.com/npm/cli/blob/latest/workspaces/config/lib/definitions/definitions.js)：fetch retries2、单请求timeout5分钟，不修改它们制造通过。

结构范围仅 Dockerfile / Compose 配置字面读取；graph coverage 标记候选 test-results 子树excluded，已直接读取实际候选。无代码调用链推断、SQL或产品行为修改。

复跑（会创建自有临时目录和镜像，仅依赖 Docker，不用宿主 npm）：

```sh
export T29_COLD_OUTPUT=test-results/t29-cold-replay-unique
python3 test-results/t29-cold-install/diagnose.py
python3 test-results/t29-cold-install/web.py
python3 test-results/t29-cold-install/finalize.py
```

实际先运行 diagnose 的探针/management，再以同 run 函数执行 Web（随后固化为 web.py），再 finalize；代理元数据键从错误大小写 HTTPProxy 更正为 Docker JSON 实际 HttpProxy 并重新采集，最终环境值如上。固化脚本最终点通过 Python AST syntax，不冒称修改后的脚本全部重跑。每个原始命令/结果 JSON 是实际执行记录；失败/timeout不会被写成通过。复跑需给 T29_COLD_OUTPUT 尚未使用的目录；diagnose 拒绝已有 work.json，避免覆盖留存证据。最终脚本另补此输出目录保护，未重复联网构建。总时间上限含每条命令150s及取消宽限12s，非无限重试。异常中断可按 work.json 和精确三个 image 名/ID人工清理，禁止 prune。

## 清理与限制

`cleanup.json`：自有临时目录、management/web 标签与探针精确image ID均已删除；三个 image rm 退出0；检查容器自动 --rm，无自有 builder/network/DB/volume，剩余仅原 templux web/api/database 与 traefik。没有新秘密或 npm 凭据文件。默认 context仍desktop-linux；原 deployment、.env、presentation、Ego31/真人/Feishu全未操作。

**没有 prune 共享 builder cache。** 默认 builder中本次产生的可回收构建记录/层由其既有GC管理，不能安全按项目隔离清理；镜像标签/工作目录已清，不以清理要求为由删除其它项目cache。此可回收存储留存明确报告，不声称Docker磁盘无新增字节。无需全局设置变更或宿主额外权限。

仅文档/诊断证据，无TS产品改动，未重跑typecheck/SQL/业务全套。最终 SHA inventory、脚本AST、限定文档/脚本/JSON的diff及秘密模式扫描见 `verification.json`。完整 raw Compose 日志保留原始尾随空格/CR，因此全文件 diff --check 会提示日志空白；不改写证据来消除该提示。历史失败保留，本次默认冷构建成功范围供独立复核；Linux宿主/WSL2/真人Feishu缺口继续保留。
