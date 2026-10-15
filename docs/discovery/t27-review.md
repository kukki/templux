# T27 独立审查：更新发现、调度与累计路径

## 范围与结论

- 固定范围：`6182006d63f3ec1d5d3d8bbff1a6626faa9d311e..8d088b62dc273ecc688d89c93b1a989ff2f45c60`。运行实现 `3a1eb4e699152039c42efd56a73f79a5b49fa179`；`a1738ad73142387f0b0efa28df0e6182eec31cf1` 仅修改调度测试断言。
- 同一独立审查者依次检查 Standards / Spec，依 Team 权限不另派审查者，不修改实现。
- 依据：Gitea #28/#1 故事9、10、14，ADR0001/0002/0012/0029，`docs/specs/update-discovery.md`、T25/T26 共享发布与提案合同、T27设计/计划/验收记录及32文件差异。
- **Standards：0项发现。Spec：2项 P2。建议暂不验收 #28，先修复以下限频边界。** 累计提案、来源校验和最终交付路径在本次独立验证范围内通过；101项已有测试通过不能覆盖以下反例。

## Standards

未发现需单独修复的仓库规范违反或有实证的结构性问题。发现/状态/调度/来源/累计协调分离，继续调用 T26 的项目所有权、检查与交付模块；API/Web 未添加更新timer，工具无部署/socket权限，项目入口及独立Compose由项目自行启用。

按 codebase-memory Tier2，search_graph → trace_path → get_code_snippet 核对 `checkUpdates` 的 CLI/schedule 调用及 source/cumulative/T26 依赖；对29个证据文件逐路径检查覆盖，均为 metadata_match / best_effort，无记录缺口。目录级查询本身 not_tracked，已直接读取实际模块，未用图的缺失证明不存在行为。

## Spec

### F1 / P2：合法长周期溢出 Node 定时器，调度几乎立即重跑

**位置**：`tools/updates/schedule.mjs:5`（锁冲突等待同风险在第7行），配置允许范围 `tools/updates/config.mjs:3`。

**触发**：已有持久 attempt，合法 `intervalSeconds:2678400`（31天），启动 schedule。`nextDelay` 得到约2,678,400,000ms，直接交给 Node 的 `timers/promises.setTimeout`；超过2,147,483,647ms时 Node将延迟设为1ms。

**独立实证**：最终原生镜像、不覆产品源运行 `test-results/t27-review/scheduler-repro.mjs` 的 overflow 场景：输出 `TimeoutOverflowWarning: 2678399998 does not fit into a 32-bit signed integer. Timeout duration was set to 1.`，**17ms** 后 `no_update`，配置周期2,678,400,000ms。该过程确实读取catalog并更新attempt，不只是计算延迟。持续调度可迅速反复发请求/准备检查；不是31天精度误差。默认每日周期不受此溢出影响。

**合同**：周期1–2678400秒可配，持久attempt包含失败也限频，不应由合法配置造成紧循环。

**建议**：将长等待分为不超过Node上限的可取消片段，并根据持久期限重新判断；所有等待入口共用有界等待，保持回拨最多一周期合同。补真实timer或注入timer边界回归，至少覆盖上限前后和合法最大值，验证尚未到期不执行检查。不要只测试 `nextDelay` 返回值。

**文档核对**：Context7 `/websites/nodejs_latest-v24_x_api` 返回的 [Node24 Timers 文档](https://nodejs.org/docs/latest-v24.x/api/timers.html) 明确大于2,147,483,647的delay被设为1，promise变体适用；不要求精确毫秒唤醒来判此缺陷。

### F2 / P2：等待期间 attempt 更新后，调度仍用旧期限执行

**位置**：`tools/updates/schedule.mjs:5`，配合 `tools/updates/check.mjs:10` 取得项目锁及第11行写attempt。

**触发**：scheduler读取lastAttempt并等待；等待中另一次允许的人工check或另一调度实例取得锁并写入更晚attempt。旧等待结束后直接调用 `checkUpdates`，没有重新检查最新期限；项目锁只防同时执行，不能防相邻过早执行。

**独立实证**：同一脚本 manual-during-wait 场景，配置2秒，先写当前attempt，启动有限schedule；等待1.4秒后人工check成功写新attempt。schedule仍在原约2秒时开始，**距人工attempt仅595ms**，状态 `no_update`，未返回locked。人工check明确允许立即执行；此处违规的是之后自动检查没有从最新持久attempt限频。默认每日也可能在人工检查后很快重跑。

**影响/合同**：手动与自动入口共存时，持久记录不再保证自动检查周期，重复来源请求/构建可早于配置期限；单进程正常双tick和普通重启正例不能覆盖此交错。

**建议**：自动模式取得同一项目锁后重读最新attempt并判断是否到期，再记录本次attempt/开始工作；未到期则释放锁并重新等待，人工check保留显式立即执行。仅睡醒后锁外重读仍留竞争窗口。加入人工检查发生在等待中及两个调度实例的有序交错测试，覆盖成功和失败attempt；保持残留锁人工恢复及回拨策略。

**最小复现（两项共用）**：

```sh
docker run --rm \
  -v "$PWD/test-results/t27-review/scheduler-repro.mjs:/review.mjs:ro" \
  --entrypoint node t27-updates-final /review.mjs
```

脚本在容器内创建自有合成发布/状态，finally清理；无数据库、全局任务或外部网络。原始结果 `test-results/t27-review/scheduler-repro.log`。

## 独立执行与产物

证据根：`test-results/t27-review/`（忽略目录，供本地复核）。

| 检查 | 独立结果 / 证据 |
| --- | --- |
| 最终测试与类型 | `final-suite-types.log`：101/101、0失败/跳过，随后API/Web typecheck退出0。执行 updates-*、release、project-interface、project-web-server、upgrade/upgrade-checks/upgrade-merge；原生最终镜像，无测试覆源。早先较窄glob另跑54/54，仅为子集，不冒充101。 |
| 来源/异常/调度回归 | 上述测试包含真实自有loopback HTTP逐文件Bearer、401/403/redirect/timeout/坏JSON、文件token权限、pin/hash、损坏receipt、并发lock、双tick与重启限频；另补两项本文反例。HTTP服务随测试关闭。 |
| 真实累计 | `real-command.json`、`cumulative.json`：自有83文件输入副本，独立state/output，0.1.0→0.2.0-t26.1→0.3.0-t27.1，`proposal_ready`。每步7项均passed，包括真实npm/API/Next/behavior；非仅helper模拟。 |
| 外部补丁 | `apply-proof.py`、`external-apply.json`：独立 `git apply --check` 后实际apply，按vendor清单替换包；完整90文件集合/SHA/mode等于candidate及report.final，重算tree SHA `69140dc46fc35f0432a97036e5f745973c91d92f90cd06153a50707d058f7260` 相等。项目业务version/presentation保持；最终baseline绑定最终manifest。 |
| 应用副本真实消费 | `applied-build.log`，退出0：`npm ci --ignore-scripts`、包组合installed校验、API build、中间shared-version与终点final-release检查、`NODE_ENV=production` Next build、项目behavior。未挂模板源码作为项目依赖。 |
| 重复检查 | 自有最终提案再check返回 `duplicate`（`duplicate.json`）；完整tree篡改拒绝由101专项覆盖。 |
| 镜像/源 | `source-audit.json`：20文件逐字节与宿主、开发声明SHA对照一致；最终 `sha256:eb60f9289b0a848091d487bca7e8c8e0789443cfa54421f1da74b36e8862537c`。未以旧镜像覆源冒充最终镜像。 |
| 发布身份/原输入 | `readonly-cleanup.json`：原消费者79、T26输入80、T27输入83全部字节/模式对比既有before一致；自有输入亦未变。0.1/0.2完整发布库存与原产物一致，0.3 manifest及catalog精确标识符合指定值。 |
| Shell与变更卫生 | `sh -n project-template/check-updates`、`git diff --check`退出0；仅审查报告纳入提交。 |

最终独立安全提案保留于 `test-results/t27-review/proposal/`，含中间两步报告和候选、最终patch/vendor/报告。它仍是可审查提案，不是已部署版本。

## 开发证据核对与局限

- 核对开发 `source-image.json`、最终源对照、发布hash、`final-audit.json`、菜单PTY/manual、有限调度/清理记录。菜单本轮未另开PTY；人工命令及duplicate本轮实际执行。真实累计开发使用7fbe…镜像，本轮使用最终eb60…；两者20个产品工具/适配源相同，测试镜像区别如实保留。
- `a1738ad`仅将单进程调度HTTP到达间隔改为检查开始间隔，附加请求次数断言，仍保留HTTP重启检查。这符合开始时刻限频的合同，并未改产品来迁就测试；但没有覆盖本文长周期与等待中更新记录。
- 开发最初100/101失败日志与验收路径写错导致的build失败均未当作通过证据。本轮实际应用副本使用真实 `.templux/verify.mjs` 路径，最终build退出0。
- 固定HTTPS/拒redirect/令牌传递、每边产物from核对、同版本身份、prerelease与同主版、失败停止中间步、T26快照/patch门禁及只读输入均检查源码与相关容器回归。来源无pin的信任是transport-trusted；目录授权和项目代码信任不构成恶意代码沙箱。
- 真实网络测试只为自有loopback HTTP，不代表实际外部HTTPS授权/TLS服务已验收；未等待24小时或31天，长周期缺陷由Node真实溢出观察，默认86400为配置/计算证据。无跨平台/强杀每个文件故障点穷尽保证。
- 0.2/0.3为显式测试发布，无外部发布。包内认证/SQL/运维未修改；沿用T25/T26证据，本轮不声称重新SQL身份/浏览器/维护恢复验收。**T03真人飞书组织链路仍pending**。

## 清理与后续

自有累计/应用容器均 `--rm`，无残留 `templux-t27-review*` 容器；自有临时项目（含node_modules、构建缓存、state）已删除，仅保留非秘密提案/脚本/结果。未建数据库/卷/密码/token文件，未注册全局计划；原schema0004部署、.env、现用presentation、Ego31、真人/飞书未操作。

修复F1/F2后应定向复核持久限频，不需机械重复SQL/浏览器全套；最终验收由TL安排。本次不修改实现、不push、不关闭#28。

## 修复定向复核附录（F1/F2）

### 固定范围与两轴结论

复核 `76a123c4a267be0ae5d22d18a1d2c16ec6547aba..754ecb165324e26410ec9a49ed59ff6084f94c31` 全8文件差异，产品实现 `9cbc7a097a7579139b91484346d553b2326e9d2f`，最终测试点 `dbaa961fdb019d88d1583d60d783d4430e45d41f`。读取修复验收、合同补充及本文初审历史。仍由同一审查者分别执行两轴；初审结论保留为历史。

- **Standards：0项新增发现。** 等待统一至 `waitFor`，自动期限统一至现有state锁内判断；无额外业务定时器、全局任务、权限或部署入口。
- **Spec：F1、F2均关闭，0项新增发现。** 结合初审真实累计提案、外部90文件补丁及实际消费构建证据，建议 #28 按既定范围验收。T03真人飞书组织链路仍pending，与此结论独立。

### 修复核对

**F1关闭**：`tools/updates/schedule.mjs:4` 以 `performance.now()` 单调期限重算剩余，所有片段含 `Math.ceil` 后仍不超过2147483647ms；普通延期和锁竞争/发布前失败退避共用该等待。周期上限31天未缩小，AbortSignal贯穿每段；已取消信号不开始timer，首/第二片段取消拒绝原生等待。schedule只将信号实际取消的AbortError视为结束，其它异常继续上报。Context7当前Node24官方timer文档再次核对溢出与promise变体语义；没有把不精确的实际唤醒时间当作期限保证。

**F2关闭**：`tools/updates/check.mjs:10` 同一操作锁取得后，11–17行读取validated attempt、计算自动期限，再决定延期或发布新attempt。deferred不写attempt、不请求来源，finally释放锁；schedule等待后重新取锁，延期不消耗max-runs。人工check不携自动模式，仍立即执行，但坏attempt不能被静默覆盖。回拨回执仅对同一完整attempt内容指纹有效；替换ID/内容必须重新等待，完整单调周期后允许结束未来时间导致的延期，避免永久延期。失败attempt仍限频；发布前失败/locked退避无紧循环，result发布失败不能返回成功且锁释放。该回执为工具内部调用状态，不是对不可信代码的安全沙箱。

图查询按search→trace→snippet核对schedule/check/state及waitFor，9个依赖证据路径coverage均metadata_match、best_effort无记录缺口；同时直接读取完整变更及相关config/入口，未将图的无记录当作完整性证明。确认 tools/upgrade、tools/release、apps、database、project-template、Dockerfile 在本修复范围无差异，因此沿用初审累计/包/SQL证据，不重跑无关部署矩阵。

### 本轮独立实际执行

证据根为 **`test-results/t27-fix-review/`**；未覆盖开发的 `test-results/t27-fix/`。使用原生最终工具镜像 **`sha256:24d620ab0bd6eb5ac07e745c1695f0e7665edc41636e1c97dc010d570f373251`**，不覆产品或测试源。

| 检查 | 独立结果 |
| --- | --- |
| 最终123专项/APIWeb类型 | `suite-types.log`：123/123、0失败/取消/跳过，随后API与Web tsc退出0。测试范围为updates-*、release、project-interface/project-web-server、upgrade/upgrade-checks/upgrade-merge。 |
| 原反例旧镜像RED | 同一版本化 `tests/scenarios/t27-scheduler-repro.mjs` 挂载旧eb60镜像：31天周期24ms即检查、发生TimeoutOverflowWarning，人工后602ms自动检查；脚本最终断言失败。`repro-red.log`保留，不当通过。 |
| 原反例最终GREEN | 同脚本挂最终镜像，退出0：31天等待153ms主动取消，runs0、HTTP0、attempt不变、无overflow；2秒周期人工后自动attempt间隔2010ms，HTTP仅人工和自动各一次。`repro-green.log`。 |
| 长周期边界/取消 | 123专项含MAX−1/MAX/MAX+1/2678400000分段，受控单调时钟验证最后1ms前不完成；原生首段/第二段Abort以及大周期锁竞争取消均通过。真实31天/24小时未等待；受控边界与真实短时观测分开。 |
| 原子期限/故障交错 | 专项含睡眠中manual、醒后锁前manual、双自动实例/两个真实scheduler、失败manual、回拨同指纹与更换指纹、真实回拨完整单调周期、坏attempt/null/JSON、attempt/result发布失败及锁释放。没有以HTTP到达间隔代替attempt开始时刻。 |
| 独立CLI/Compose | 自有目录复跑版本化proof的审查副本，仅改证据根和Compose项目名：CLI双tick1063ms，人工立即319ms，独立进程重启后1076ms，独立Compose双tick1071ms；均是持久attempt边界。`container-proof.json`、commands.json和各stdout/stderr。无全局注册。 |
| 镜像/原输入 | proof核对20产品工具/适配源逐字节/SHA匹配最终镜像；79/80/83原输入完整文件SHA/模式保持；0.1/.2完整发布库存相等，0.3 manifest指定SHA保持。`source-audit.json`、`container-proof.json`。 |
| 语法/卫生 | `sh -n project-template/check-updates`、Python版本化fixture和审查副本内存compile、`git diff --check`均通过。仅审查文档纳入提交。 |

实际命令主干：

```sh
docker run --rm --entrypoint sh t27-fix-final -c \
 'node --test tests/updates-*.test.mjs tests/release.test.mjs tests/project-interface.test.mjs tests/project-web-server.test.mjs tests/upgrade.test.mjs tests/upgrade-checks.test.mjs tests/upgrade-merge.test.mjs && npm run typecheck'
docker run --rm -v "$PWD/tests/scenarios/t27-scheduler-repro.mjs:/repro.mjs:ro" \
 --entrypoint node t27-fix-final /repro.mjs
python3 test-results/t27-fix-review/container-proof.py --image t27-fix-final
```

### 证据边界与清理

本轮独立使用loopback HTTP及目录来源，不代表真实外部HTTPS服务、全天周期或所有宿主平台已验收。长周期/回拨的一部分使用受控计时器和时钟；真实Node取消、短周期、进程重启及Compose另外实测。开发早期未完成MockTimers运行、中间编译错误、前轮120项未作为本轮成功依据；本轮完整123及最终镜像独立完成。

累计/propose/认证SQL包未改，沿初审本审查者独立两边构建和完整外部patch等价结果，本轮不声称再次执行累计构建、SQL身份、浏览器或生产镜像构建。T26快照/最终交付门禁在123相关回归内保持通过。

自有proof state/output、运行配置已删除；Compose down完成，检查无自有scheduler容器/网络或残留锁，所有docker run均--rm。没有DB凭据、token文件或业务卷；仅保留安全脚本/日志/源hash证据。原schema0004部署、.env、presentation、Ego31、真人及飞书未操作。未改实现、未push、未关闭#28；后续由TL安排验收。
