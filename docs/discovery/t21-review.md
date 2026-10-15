# T21 独立审查：持续维护、停写屏障与安全恢复

## 范围及双轴结论

固定范围 `aa5f0c53b769e9ff800c0697b6a7262cd9e7a1e4..25ed399ac4dd1b3e2739068db67ca25333bc3ba0`。审查时 HEAD 为后者，初始工作树干净。同一独立审查者依次执行两轴，不新增成员。

已读取 Gitea #22/#1、ADR0025/0026/0028、维护合同、计划及开发验收，审查全部 39 文件差异；SQL/锁验证前加载 Postgres 技能。

| 轴 | 结论 |
| --- | --- |
| Standards | **0 项发现**。未发现本范围违反已记录仓库约定的变更或需修复的基线代码异味。宿主受控管理、集中公开文案、审计允许字段、单独入口及共享组件职责符合现行约定。 |
| Spec | **0 项发现**。所审查的持久提醒、停写、入口及显式恢复符合 #22 与实施合同；建议按本报告边界验收 T21。 |

此为代码与可独立执行链路的验收建议，不替代 T03/#4 真实组织飞书人工验收，也不宣称完整首版、后续备份产品或升级任务完成。

## 关键源码检查

- `maintenance.ts:12`：session try advisory 操作锁覆盖版本核对、Docker 动作和回执发布；事务先取独占业务写锁，再读最新单例及 CAS。状态变化和关键审计同事务；无变化不伪造变更事件，已 online 的回执修复仍要求新的 `maintenance_release_authorized`。COMMIT 抛错不调用停止或发布、不自动重试，连接按未知结果丢弃。
- `0009_maintenance.sql:15`：8 表 statement trigger 覆盖 I/U/D/TRUNCATE，共享事务锁持续至提交/回滚。VOLATILE 函数锁后用 READ COMMITTED 新快照核对 phase，直接拒绝其它隔离级别；独占锁在单例修改之前取得，避免屏障与状态更新锁反转。审计/维护/迁移元数据排除以保留恢复职责；项目新增表及外部写者必须显式接入，未伪称数据库 owner 或任意新表自动受约束。
- `maintenance-cli.ts:17`：halt/resume 先核对 entry 存活。halt 先提交 offline/强审计，再停 API/Web；resume 先 `up --no-build --wait` 检查既有服务，提交确认后才发布回执。Docker 失败不假称 SQL 回滚；rescue 不访问维护状态作为停服前提，明确返回屏障/审计未核验。
- `maintenance-release.ts:6`：只接受普通、非符号链接、大小受限的严格 JSON 回执及精确 gateVersion；首次 gate0 无文件例外明确。发布用同目录随机排他临时文件、NOFOLLOW、0644、文件 fsync/rename/目录 fsync，清理仅限已创建临时文件。SQL/文件/Docker 非原子，rename 后异常可能已可见的局限已记录，未假称可回滚。
- `maintenance-entry.ts:10` / `application.ts:21`：entry 与 API 均核对 SQL 及 gate。offline 用独立 503 项目风格页面，DB/回执未知用不同不可用页；不删 Cookie。公开状态与 health 只用于诊断/恢复，不执行业务写入。入口未存活时不保证维护页面；根 Compose 公共端口归 entry，Web 不发布宿主端口。
- `proxy-peer.mjs` / Web socket 入口：Web 每次解析显式 entry DNS peer，只有精确 peer 才接受内部来源声明；entry 删除外部伪造头并从 socket/CIDR 链重建。缺失/非法声明或解析失败不接受该声明，既有 API 对 Web peer 的限制保持。
- `maintenance-notice.tsx`：独立根布局通道，SSR 与周期核对持久状态，显式未知不当作结束；倒计时到点不撤通知、不写业务状态。React 文本呈现、独立高度与普通通知避让；不新增关闭/收起或管理 Web API。effect 取消旧请求，ending 优先停用旧内容。公开说明不进入关键审计/运行日志。
- CLI 菜单18–24与完整参数共用确认/CAS规则，JSON stdout 仍单结果，诊断 stderr；人类状态明确包含 accessReady。恢复只检查已有镜像，不 build/migrate/deploy。原 0001–0008 与基线无差异；0009 作为新迁移后，gate 增强另追加 0010，不改已应用脚本。

结构探索使用 index status → search → 双向 trace → snippet。39 个差异路径及相关代理、限流、ADR 路径检查覆盖；0009 存在 PL/pgSQL 局部解析缺口（2、17–23、26–30行），已完整直读并以真实 SQL 检查补足。图谱仅 best-effort，不将 metadata_match 当作安全或动态调用完整性证明。

Context7 核对 [Postgres18 advisory 锁](https://www.postgresql.org/docs/18/explicit-locking.html) 与 [显式锁/快照一致性](https://www.postgresql.org/docs/18/applevel-consistency.html)。session 锁断连即释放，不能当作 Docker/SQL/文件跨系统事务或无限租约。

## 独立实际验证

自有 Compose 项目 **t21-review**，配置副本 `test-results/t21-review-deploy/`，端口 **31141/31142**，独立数据/维护卷；未使用根项目的启动/停止/迁移命令。复用最终发布镜像，无源码覆盖旧镜像冒充最终包。

### 最终专项及源码对应

```sh
docker run --rm --network t21-review_default \
  -e TEST_AUTH_DATABASE_URL=postgresql://templux_test:isolated-test-only@database:5432/t21_review_unit \
  t21-checks node --test --test-concurrency=1 \
  tests/maintenance.test.mjs tests/maintenance-http.test.mjs tests/cli.test.mjs
docker run --rm t21-checks npm run typecheck
```

- **21/21**，fail/cancel/skip 均0；API/Web typecheck 退出0。`t21-independent-{targeted,typecheck}.log`。
- 专项含真实 SQL 审计失败回滚、在途提交/回滚、锁内并发排斥、版本冲突、真实 COMMIT 后包装器抛错、发布调用0、fresh 审计故障及真实 CLI 子进程输出。COMMIT 未知是受控 ACK 异常，不冒充物理断网。
- 新自有库实际迁移 **10 项到0010**；`t21-independent-migrate.log`。另外独立库对 **8表×4类语句共32项** 均得到55000，online 下 REPEATABLE READ 写同样拒绝；`t21-independent-table-barriers.log`。这是 statement 屏障检查，不声称执行业务字段有效性矩阵。
- 主机与最终 checks 的21份源码、10份测试源码 hash 一致；checks/API/management 的10份编译文件 hash 一致。Web 的 socket server/共享维护模板/代理/copy 与主机相同。`t21-independent-integrity.json` 与 `t21-independent-web-{host-,}hashes.log`。最终镜像：API `e7342a0f5eb7…`、Web `32f255498ddb…`、management `c56f8e66e8ea…`、checks `81813d839b9f…`；不把 hash 相同代替运行证据。

### 自有真实停服、恢复及来源链

`test-results/t21-review-driver.mjs` 严格断言自有绝对目录及项目名，通过一次性 management 容器调用正式 CLI；结果 `t21-independent-operations.log`：

1. 缺 confirm 拒绝。开始过去时刻提醒后仍 online，未自动停写。
2. 伪造 XFF/内部头连续变换，未知用户名返回 `401/401/401/401/429/429`；SQL 中真实容器 IP/规范用户名组合 failures=5，另一独立容器同用户名401，未塌缩到 entry/Web 单IP。
3. 实际写事务持共享锁，halt 等待且未先停服务；回滚后停 API/Web，排队写55000，原写与排队写均未落库。entry/DB仍运行、公开页503且无 Cookie 清除。offline end 拒绝。
4. 正式 resume 启动/健康检查并开放，登录页200，匿名 protected API401，提醒仍持久 active。
5. 实际停止自有 DB：entry live200、公开页为“状态暂时无法确认”503。rescue 真正停业务，返回 containersStopped=true、barrierVerified=false、auditSaved=false，stderr记录 audit unavailable；status 非零。DB恢复后显式 halt → resume → end，正常200且提醒清除。

### 回执及原子发布故障

版本化驱动的 ignored 副本仅替换自有项目/路径限制，未修改实现或正式测试；实际结果：

- `t21-independent-publish-failure.log`：目标文件设为目录，真实临时写/fsync 后 rename 失败，CLI非零；SQL已online，但entry/API503、内部health200、临时文件0。移除故障后明确 resume，新的强审计授权修复成功、0644。
- `t21-independent-release-faults.log`：缺失、坏JSON、旧gate、旧schema、错误类型、多余字段、不可读7种均 entry/API503、health200、不清Cookie。明确 resume 后 changed=false、accessReady=true，正常登录页200、匿名业务API401。
- 最终生产镜像通过 entry 的工具页及测试认证路径404，maintenance POST404；`t21-independent-production-boundary.log`。

## 开发证据核对及精确边界

- 已核对279/279完整日志，但该点早于最终 accessReady 人类输出和临时文件清理改动，**不称最终源码全套重跑**。本轮独立最终包21项、类型检查和上述实际故障链路分开记录。
- 已核对开发真实人员/责任人关联Agent正常密码访问200与管理403、管理员 audit200、host_claim不冒充应用身份；提醒13秒→到点→刷新/导航/重启、满普通队列不挤占/清除后高度复位及普通通道保留记录。本轮没有创建凭据或重跑全部身份/队列浏览器矩阵。
- 逐张查看开发 **4张真实PNG**：提醒与业务确已停止的维护页，各1440×1000及390×844。文案、风格、关键入口无明显裁切；维护页不依赖Web脚本/图片。图片来自真实 agent-browser 会话替代失败的Ego截图，不是生成图；本轮未重新截图，不作像素差异、读屏或定量对比度认证。
- 核对0008及0009隔离 dump → scratch pg_restore 日志，两个备份实际权限0600，0010 applied1；第二空项目迁移0010/gate0无回执启动与无默认授权、根Compose卷隔离/只读权限以及另一项目错误回执只关闭自身的证据。本轮从空库另做实际安装，未重复已记录的备份恢复演练；未把后续备份产品判为完成。
- 健康失败、Docker路径失败、正常重启会话仍有效、实际HTTP活动写等待等开发实证已核对，与本轮独立样本分开，不外推真实 TLS/NAT/宿主平台矩阵。

失败尝试保持透明：首次并行启动时 CLI status 子进程碰到自有 API 未就绪超时（`t21-independent-startup-race.log`）；服务健康后完整21重跑通过。额外 SQL 检查最初误用 GENERATED ALWAYS id 自赋值，在重写阶段就被 PostgreSQL拒绝，随后改用实际非identity字段，32项正式结果以上述日志为准。这两次为验证准备问题，不当作产品缺陷或成功证据。

## 清理、限制及验收建议

已 down 自有 t21-review 并删除其容器、网络、数据/维护卷及空0700私有目录；本轮未创建浏览器空间、账号或交付凭据。保留 ignored 公开脚本/结果供复现。原服务仍健康，`/api/status` 为 ready、connected、schemaVersion **0004**，见 `t21-independent-cleanup.log` / `t21-independent-original-{status,services}.json`。未改 .env、现用presentation、部署、Ego31、真人权限或飞书，不推送、不关闭#22；提交仅本报告。

没有发现需阻塞本票的 Standards/Spec 问题，建议验收已定义的 T21 范围。限制：入口/DB/宿主仍可用是维护页前提；Docker/SQL/文件不是原子事务，ACK未知和连接丢失必须人工核对在途动作；未接入表、DB owner、手工跨项目共享卷不受此机制保证。未机械重跑279、生产构建、全平台/物理触屏/读屏或真实TLS/NAT；运行日志容量不是14天保证。T03真实组织人工OAuth仍单列pending，未以此验收替代。
