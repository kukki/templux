# T29 默认冷安装定向独立复核

## 结论与范围

2026-10-16，独立审查者：审查。任务 `01a1409c-c32b-71f3-b591-317994265152`。

- **Standards：0 项新增发现。** 固定范围仅补验文档与诊断证据，未改产品、候选、默认网络、全局 builder 或代理配置。
- **Spec：本机默认冷依赖构建补验通过。** 独立自有副本的 management、web 默认 Compose `--no-cache` 构建均实际退出 0，可闭合此前本机默认冷安装路径缺口。
- **#30 / 父 #1 仍未达到完整验收。** Linux 宿主、WSL2、本人授权的真实 Feishu 组织链路三项仍未执行；本报告不关闭这些工单或 T03。

审查固定范围 `8f055e3acc7fac8e5da43ac622ae2ecf81059711..391120b2076017a79b0d83e094326f63e1092855`。读取原完整审查的冷网络结论、`t29-cold-install.md`、本次全部 23 个变更文件及候选 Dockerfile / Compose。两轴由同一独立审查者依次执行。未重跑 517、类型检查、SQL、身份或浏览器矩阵；没有 TS 或产品修改。

## 来源与配置核对

来源保持 `test-results/t29/releases/0.1.2-t29.1/project`，运行源码 `c02ac42859b7140a5e76f7b4126b18973bbdd84f`。交付清单 SHA256 仍为 `3928db76aee723b9b16d839b3d1579c38b797d2dc8b56316ca7bf1e2ad63f237`，未重建或重绑发布。

| 固定文件 | SHA256 |
| --- | --- |
| Dockerfile | `a39eb85836a9f0741c4cff06fea9815680c8892a6ce0ec78ee2611a32c2bae7f` |
| compose.yaml | `94d144148023fea3fdd60c24c80570d3d17faeb3c38ccdef892e0f705b2b45c3` |
| package-lock.json | `cbc901ed75f8bc09afa4f723b20388ebe1ab5f4a4bd587a121d6dba36b825dda` |
| templux.lock.json | `a1e0b4b09b6fc99f6ddb1549282afb2a6255cbd8b3cabae08cdbb44cd0477ae4` |
| manifest.json | `de067a89e34f10a482286d7d8b330e9522ab7ad7bb1c7d751c9c9317d6f13878` |

自有副本 `/Users/jkoo/git/templux-t29-cold-review-fi3il3tt/project` 构建前后全部文件 SHA/mode 与候选一致；候选本身也未变。23 个交接文件逐字节对照固定提交保持不变。没有 `.env`、宿主 npm 配置或依赖缓存进入副本。

实际环境：macOS 上 Docker Desktop，Docker 29.8.2 / Linux arm64 VM，默认 context/current builder `desktop-linux`、driver `docker`、BuildKit v0.33.1。宿主六项代理/builder 相关环境键均不存在，Docker client 无 proxy profile；Engine 已有代理配置仅记录存在性，未读取或输出代理值。worker 的 `network=host` 标签不代表本次 RUN 使用 host 网络，实际命令无该覆盖。

独立以 `--profile tools config --format json` 在内存解析，仅保存 management/web 的 build 字段：都是当前副本 context、原 Dockerfile、各自 target；无 network、args、替代 image。未输出完整配置。management 位于 tools profile，实际直接指定服务的构建日志也确认目标。

配置属于字面读取。codebase-memory coverage 对候选与诊断脚本报告 test-results 子树 excluded/not_tracked，已直接读取这些文件；不声称 graph 覆盖完整。

## 独立执行证据

安全日志和脚本在 `test-results/t29-cold-review/`。复制版本化 `diagnose.py`、`web.py`、`finalize.py`，只替换自有目录/镜像/检查容器名称；`script-correspondence.json` 验证除此之外逐字相同。三个最终脚本均实际执行，AST 检查通过。

```sh
T29_COLD_OUTPUT="$PWD/test-results/t29-cold-review" python3 test-results/t29-cold-review/diagnose.py
T29_COLD_OUTPUT="$PWD/test-results/t29-cold-review" python3 test-results/t29-cold-review/web.py
T29_COLD_OUTPUT="$PWD/test-results/t29-cold-review" python3 test-results/t29-cold-review/finalize.py
```

| 实际命令 | 上限 | 实测耗时 / exit | 证据 |
| --- | --- | --- | --- |
| `docker build --no-cache --progress=plain PROBE` | 40s | 3.818s / 0 | 默认 DNS、registry metadata 与 tarball body 读取 |
| `docker compose --env-file /dev/null -p t29-cold-review-default --progress plain build --no-cache management` | 150s | 93.003s / 0 | dependencies 新增94包，API tsc，生产API新增63包及最终导出 |
| 同命令，目标 `web` | 150s | 104.152s / 0 | dependencies 新增94包，Next构建，生产Web新增24包及最终导出 |

两次均 `timedOut:false`，没有重试。management dependencies npm ci 约85.8秒、生产API约2秒；web dependencies约7.7秒、Next约10.1秒、生产Web npm ci约85.7秒。未把静默等待解释为死锁；本次差异也不足定位此前超过240秒取消的根因。

构建结果 ID：management `sha256:0e906248e02ef95b2561e5263aadba2b5f2cc7b21879ead7caea254f192c92d2`，web `sha256:10aba417edbe2e8721da6fa8fefa7164c46e332b5b384b6b181cb1b86cd52b9a`。仅以 Node 检查入口读取聚合信息，没有启动产品业务入口。

### 冷依赖判断

- 官方 Node v24.21.0 基础镜像中 `/root/.npm` 与 `/opt/project` 不存在；上下文无 node_modules/.npm/.next，原 Dockerfile 无 cache mount 或宿主 cache 复制。
- 两次 dependencies 与各自生产 npm ci RUN 实际执行并新增包，未由 BuildKit RUN 缓存替代。没有预制业务镜像、host network、override、代理注入、新 builder 或特殊网络。
- management 聚合仍为61个 `cache miss`、62个 `cache hit` 短语及62个GET200；整份日志短语可能覆盖不同阶段，不能视为互斥请求分类。web最终镜像观察不到 `/root/.npm/_logs` 的0值不代表零请求；其安装证据来自真实RUN、包数和空基础缓存。
- 官方基础镜像及简单层复用允许，本轮未使用 `--pull`，不声称冷拉全部镜像。registry/CDN/Engine透明网络缓存不可观测，不能据此保证源站每字节物理读取；证明范围为项目本地冷依赖安装。

开发的10.702秒/27.305秒通过日志与本轮93.003秒/104.152秒独立执行分列，不混用。旧默认挂起、普通Node同锁成功、host网络成功、Bake entitlement拒绝仍是历史证据，均未当作本次默认通过。

## 官方依据与验证

本轮 Context7 resolve → query 使用 `/docker/compose`、`/docker/buildx`、`/npm/cli`：

- [Compose build](https://github.com/docker/compose/blob/main/docs/reference/compose_build.md)：`--no-cache`、`--builder` 与 `--pull` 分别控制缓存、构建器和基础镜像拉取；本次无后两者覆盖。
- [Buildx build](https://github.com/docker/buildx/blob/master/docs/reference/buildx_build.md)：RUN network 默认 default；没有把 worker 标签当作命令网络覆盖。
- [npm ci](https://docs.npmjs.com/cli/v11/commands/npm-ci)：锁定安装、清理已有 node_modules；原 `--ignore-scripts` 等参数保持。

`verification.json` 记录3条有界命令全0、25个证据文件摘要、AST3及秘密模式扫描0命中；扫描有界，不声称任意秘密检测完备。固定范围非日志 Markdown/Python/JSON `git diff --check` 退出0；原始日志CR/尾空格原样保留，没有重写历史证据来消除空白提示。

## 清理与剩余限制

`cleanup.json`：自有两个镜像标签、探针精确image ID删除均退出0，自有副本和 Python cache 删除，检查容器均 `--rm`。无新增DB、卷、builder或网络。剩余运行容器仍仅 templux-web/api/database 与 traefik；默认context保持desktop-linux，未操作它们的服务、配置或数据。

没有 prune 共享 BuildKit cache，本轮可回收层留给既有GC；不声称Docker磁盘无新增字节。安全诊断日志留档，没有创建凭据或归档。产品候选、正式产物、交接证据、原.env/presentation、真人/Ego31/飞书均保持。

本轮允许关闭的仅是**当前macOS环境、准确候选、默认构建网络的冷依赖路径补验**。不保证网络持续可用、不解释历史挂起根因、不将Docker Desktop Linux VM冒充Linux宿主。Linux宿主、WSL2、真实Feishu人工验收继续开放，#30/父#1/T03均不得据本报告宣称完整通过。
