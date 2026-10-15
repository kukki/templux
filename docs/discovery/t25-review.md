# T25 独立审查：共享包发布、锁定与真实项目消费

## 范围与结论

2026-10-15；固定范围 `58de199c5965ae7eb4189130029809be0f96e17e..dce3f349b417f20628e0723c8c1d9f0981921b94`。正式产物来源为实现提交 `66aa7c2d3f5f4fd921837e9804c4fc1d9cbb0bfa`；其后仅验收文档、计划和HTTP测试断言变化，产品未变。

读取Gitea #26/#1、ADR0011/0012/0029、共享发布/项目创建合同、计划/验收及全部50文件差异。同一独立审查者依次完成双轴。

| 轴 | 结论 |
| --- | --- |
| Standards | **0项发现**。核心扩展、发布与项目骨架的边界符合现有ADR，无生产认证fixture、宿主npm要求或新业务范围模型。 |
| Spec | **0项发现**。锁定的真实tar包、仓库外消费、独立前后端构建、正常认证及包内运维实证支持 #26 按本次范围验收。 |

T03真实组织飞书人工验收仍单独pending；本票不代表后续升级提案/调度或首版最终全范围交付。报告不关闭工单。

## Standards：接口与实现

- `apps/api/src/project-interface.ts:15–38` 限定GET/POST、静态业务路径、唯一method/path、显式已注册permission和handler，不公开Fastify钩子或替换核心路由。授权共享锁后读取真实Cookie对应最新持久身份/状态/版本/角色，要求application:read及业务permission；POST精确Origin、写共享屏障和维护释放检查，scope/handler在同客户端事务内，确认COMMIT后才返回。没有把项目scope可选理解为默认授予业务数据范围。
- `changeProjectAccess` 复用独占授权锁，将项目变更、版本失效和强审计放在同一事务。调用者自身管理权限仍由项目服务核验，宿主CLI不等于浏览器权限；source/actor不能伪造已验证身份。exports与Readonly类型均不是恶意同权限代码沙箱。
- `tools/release/build.mjs` 实际staging→npm pack两包→清单/项目锁/原基线→npm锁→最后complete；版本目录排他创建，失败无complete，不自动覆盖未知产物。core包含T02–T24认证/会话/审计/运维/SQL及配置，Web包含页面/元素/状态/样式和资产，保留内部相对资源路径。
- `verify.mjs` 从受信锁核对准确版本、组合、字节SHA256/SHA512、包内身份、项目file依赖与安装锁；先列tar路径/类型再读metadata，链接、穿越及异常类型拒绝。信任边界明确：不能认证同时被恶意替换的锁/验证器/清单。无registry发布、云外发、自动latest或自动部署。
- Web没有混合client/server总barrel，保留use client边界；公开TS/声明与transpilePackages支持真实Next构建。项目持有页面/业务/config/部署和独立业务版本，baseline保存原骨架，不回写消费方定制。
- codebase-memory Tier2：index→createProjectApplication搜索→双向trace→snippet，检查所有差异及所依赖核心/ADR路径覆盖。`.dockerignore`、API tsconfig及骨架dockerignore/两个tsconfig为not_tracked，已逐文件直接读取；其余metadata_match仍为best_effort，未作图穷尽性声明。

已应用Postgres技能核对事务/锁/恢复边界。Context7核对 [Node24 exports非强封装](https://nodejs.org/docs/latest-v24.x/api/packages.html)、[npm ci准确锁定与workspace](https://github.com/npm/cli/blob/latest/docs/lib/content/commands/npm-ci.md)、[Next transpilePackages](https://nextjs.org/docs/app/api-reference/config/next-config-js/transpilePackages)及server/client模块边界。运行时跨版本握手与所有宿主平台支持不在本票实证内。

## 独立产物、源码和安装对应

证据根：ignored `test-results/t25-review/`。只读正式产物 `test-results/t25/committed-releases/0.1.0/`，未修改或重新冒充该发布。

| 正式文件 | 独立核对SHA256 |
| --- | --- |
| manifest.json | `bbf6ad9941a784e1301129a067698a79ff23cf2b8b81801582add184ec60c5dc` |
| templux-core-0.1.0.tgz | `2a0eddc6f11cbcc67449ba15cc6dcd987f88809d70989c75f03dca9fc5df9c05` |
| templux-web-0.1.0.tgz | `5ceecfb177bff0f77fe1ea54226b158294242c226a35eed124628e9031d0e142` |

`artifact-integrity.json`：complete版本/manifest摘要一致；198项有界source.files与checkout逐一SHA一致，source输入集tree摘要重新计算相同；78项core编译文件与release-tools相同。core130/Web113均常规文件，无链接、穿越、.env、tests/fixture、凭据、备份、日志、node_modules/.git；安装后130/113文件（含metadata）逐字节匹配tar。baseline36文件及manifest摘要验证通过。不是只检查包名/版本或SHA代替消费。

另对实际运行API/entry/Web镜像与management/migration镜像再次逐文件核对（`runtime-installed-integrity.json`）：core各130、Web113全部匹配；Web复制到public的5件资产也匹配。实际应用挂载仅自有config/维护卷，无模板checkout（`runtime-mounts.json`）。

独立构建API `sha256:8a3c6621dc5885f7c0751ecfed6343e7eb02ecf2b4445d91ec9413ec4eb1c914`、Web `sha256:7f6b69a741b9b26bc477d5ffbac2bbeceace53fdcf71c1d74bb4aa66422c94f2`。标准start实际运行镜像另记录为API `a20cf3a42f8c…`、Web `39099064582f…`、entry `5c749ce25827…`，不混称同一个镜像ID；安装字节分别核对如上。release-tools仍为 `sha256:a9dd747a007f788e499032393230353cbe53b049a73f4d4595af604947ddd762`。

## 独立执行

### 专项、核心与构建门禁

- 最终 **16/16专项**，fail/skip/cancel0，`special.log`：发布11控制、核心路由接口及真实SQL/HTTP、Web缺构建诊断。最后HTTP测试只读挂到 `/opt/templux/tests/project-interface-http.test.mjs`；挂载SHA `3ba6c552e7165aab408f8001de0dbcd64caa34ad7812143963e71b083d8adb6b` 与主机相同，不声称旧工具镜像预含最后断言。
- **105/105核心回归**，fail/skip/cancel0，28.41秒，`core-regression.log`：account-management/audit/auth/backup/login-methods/maintenance/password/session。显式自有TEST_AUTH_DATABASE_URL及TEST_WEB_URL，无生产回退；API/Web `npm run typecheck` 退出0，`typecheck.log`。
- 仓库外项目分别 `docker build --target api`、`--target web` 成功，`independent-{api,web}-build.log`。独立生产API resolve next失败，Web resolve pg/Fastify失败；未让API编译Next或Web编译API。
- 为区分Docker缓存与实际重新安装，另在两个一次性Node24容器的全新临时目录分别运行 `npm ci --ignore-scripts --omit=dev --workspace project-api|project-web`，均exit0；安装前verify通过，安装后再次检查API无Next、Web无pg/Fastify。`fresh-{api,web}-install.log`，Web网络安装约1分钟；不要求宿主npm，临时目录finally删除、容器自动移除。
- 真实负例Docker构建：合法同名称/版本tar新增文件、受信锁保持不变，构建exit1停在verify，不安装/编译。`invalid-build.log/.json`。已有11控制另覆盖缺锁、损坏、范围、混版本/未知组合、包内身份、链接/穿越。补充latest依赖exit1、已有版本目录发布exit1且无complete（`additional-controls.json`、`exclusive.log`）；均只操作自有临时目录并清理。
- SQL专项以真实密码端点/受限CLI证明匿名401、scope403、跨源POST403、handler异常503及SQL回滚/私有诊断不外泄；授权锁等待后旧版本401。scope变更异常和审计失败均回滚项目SQL/版本。
- COMMIT时序使用DEFERRABLE触发器在真实COMMIT持锁：handler已结束、外部看不到新行、HTTP未返回，释放后才200。是提交等待实证，不是物理断网/未知ACK实验。
- 另在实际安装core的自有项目调用公开 `changeProjectAccess` 成功路径，项目行提交、版本+1、强审计+1、旧Cookie401（`scope-positive.log`），补足该公共组合入口的正例。未触真人或模板库。

### 仓库外项目实际闭环

从开发保留的**无秘密**消费源/config/vendor/baseline复制到自有 `/Users/jkoo/git/templux-t25-consumer-review-qu4piyg5`，没有复制模板实现仓库。项目名 `t25-review-consumer`，入口31355/API31855；测试数据库另为 `t25-review-unit`。运行版本化 `release-consumer-proof.py` 的ignored副本，仅改自有证据目录/项目名/端口。

`consumer-proof.log/.json` 驱动exit0，**7个行为场景+complete标记**：

1. 宿主wrapper标准start空库迁移0010，业务1.0.0/共享0.1.0。
2. 人员正式密码登录：零角色403、user保护200但业务permission403、user+reviewer并集业务200、他人accountId范围403；每次CLI角色变更旧会话401，普通管理API403。
3. 独立Agent关联责任人、受限随机凭据；零角色403、授权reviewer后业务200、旧会话401。
4. `/account`、`/business`、`/examples`真实SSR200与项目Quay品牌保持；admin账号/审计API200，生产fixture路径404。
5. 包内migrate --check为0010；实际备份在自有宿主backups生成0600归档且SHA匹配，没有把容器路径误作bind源。
6. 包内independent restore真实恢复到自有另库，3账号保留、旧session清零、completed-offline；源连接和原Cookie仍200，没有切换或自动开放目标。
7. 包内维护提醒持久/取消、halt入口503、显式resume后保护200，资源路径与入口回执有效。

此处不重复T23全部恢复故障或332 UI矩阵。独立恢复目标未部署Web冒充生产切换。

## 开发浏览器与历史失败证据

独立打开并查看开发四张真实PNG：1440×1000业务桌面、390×844业务窄屏/示例/撤权登录；品牌/横导航、业务响应、表内滚动与失效原因呈现相符。核对 `browser-proof.json` 和版本化脚本：真实表单输入/点击、未注入Cookie、撤权后authorization_changed。**本轮没有重跑浏览器或截图**，不将开发DOM/截图计作独立执行。

开发Ego自身空间截图超时、首次导航取消登录是失败记录；独立临时Chrome/CDP fallback才是最终成功证据，没有使用Ego31/个人profile。发布0200文件、早期错误表格状态、缺TEST_WEB_URL及shell-onlyOrigin未投影等失败与最终成功分开；本轮未复现这些旧失败，最终专项/消费首轮通过。

## 限制与清理

静态manifest组合门禁不是运行时跨版本握手；exports不是沙箱；scope/业务输入、项目SQL屏障接入与同权限代码可信度仍属项目责任。没有registry/云发布、每日检查、升级候选/自动合并，未新增迁移/恢复wire未知提交矩阵。macOS/Linux容器、Node24/PG18.6/Next16.4结果不推广为Linux/WSL宿主、物理触屏/全部版本保证。T03人工仍另列。

`cleanup-consumer.log`、`cleanup-unit.log`、`cleanup-final.json` 确认自有两个项目容器/网络/卷和临时.env、凭据、归档/key、Cookie/private目录删除；无自有浏览器/Chrome。仅保留安全消费源/config/vendor/baseline、镜像及非秘密日志/驱动；无效构建/发布临时目录已删。公开证据对自有生成秘密扫描0命中。

原状态仍ready/connected/schema **0004**（`original-status.json`）；原部署、.env、presentation、Ego31、真人/飞书未操作。历史SQL diff为空、diff检查及骨架sh语法检查通过。仅本地新增本报告，不改实现、不push、不关#26。
