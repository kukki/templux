# 三项目密码登录失败保护核对

## 已核对范围

使用 codebase-memory Tier 2 搜索、调用追踪、精确符号读取及源码验证。Supplieroom 的 `authenticateSupplier` 追踪至 limiter 的记录、判定及清理；Skoope `exchangeLocalPassword` 追踪至登录路由及数据库；Catchouse `loginWithPassword` 追踪至 `registerFailure` 和 `failureKey`。未运行登录攻击或界面测试，不宣称已审计全入口、代理 IP 信任或各项目整体限流。

覆盖检查：下表全部文件均 metadata_match，未报告覆盖问题；仅为 best-effort 证据，不证明全库完整。索引代次沿用本轮三项目密码审查记录。

| 项目 | 已核对的密码登录计数维度 | 实现与证据 |
| --- | --- | --- |
| Supplieroom | 来源 IP + 规范化用户名的组合 | `src/modules/auth/application/supplier-login.ts:24–61` 的 `rateKey`；`login-rate-limiter.ts:1–31` 用内存时间戳列表，默认 15 分钟内 5 次失败即阻挡，成功清理相应键 |
| Skoope | 已存在人员账号对应的密码凭据记录，跨来源共用 | `src/modules/auth/local.ts:37–105`，按账号查凭据并加行锁；`failed_attempts` 达 5 后 `locked_until` 设为 10 分钟后，成功清零；这里不把未知账号处理或更外层限制当作已审计结论 |
| Catchouse | 来源 IP + 规范化用户名的组合 | `server/auth.js:73–86,134–157`，`failureKey` 组合 IP/用户名，内存记录配置窗口、次数及阻挡期限，成功删除相应键；未在本题核对配置默认值 |

## 共通采用

已存在密码账号的登录失败保护包含：失败达到阈值后暂时限制尝试，成功登录清理相关失败记录。共通能力直接采用，具体计数维度、时长及存储实现不因共同能力自动统一。

## 明确分歧

Supplieroom/Catchouse 按 IP 与用户名组合计数；Skoope 按账号的凭据记录计数。本题只选择计数维度，不同时选择各项目不同窗口算法或存储方式。换来源是否共享计数由此决定，不将任一方案宣称为全面防护；模板代理来源识别等实施细节另定。

## 默认次数与时间规则补充核对

新增证据 `Supplieroom/src/modules/auth/runtime/auth-runtime.ts:29–39` 无参数创建 `LoginRateLimiter`，使用 5 次/15 分钟默认；`Catchouse/server/config.js:131–133` 默认次数 5、窗口 900 秒、限制 900 秒，均可配置；`Skoope/src/modules/auth/local.ts:8,57–71` 为 5 次、锁定 10 分钟。新增文件已覆盖检查，metadata_match 且未报告覆盖问题，其余文件复查结果相同；未读取实际部署 .env。

三项目默认阈值 5 次，直接采用。时间算法不同，不将“15 分钟窗口”误写成完全相同策略：

- Supplieroom：每次取最近 15 分钟的失败时间戳，达到 5 次即阻挡；随旧记录离开窗口恢复，不在第 5 次失败后另外固定锁 15 分钟。
- Catchouse：从该组第一次失败起计数窗口，默认 15 分钟内达到 5 次，则从触发时起限制 15 分钟；受限期间不增加失败记录。
- Skoope：凭据累计失败达到 5 次设置锁定到 10 分钟后，锁定期间不增加；锁定到期本身不清零计数，之后再次失败会再次锁定，成功或管理员重置才清零。此算法若被选用，只借用时间与计数重置行为，不推翻已确认的 IP+用户名维度。

本题仅将上述来源时间算法交 TypeSafe，不自动套用来源内存/数据库实现。

## 时间策略决策

用户选择 Catchouse 的 15 分钟窗口、5 次阈值、触发后固定限制 15 分钟。按 IP+用户名组合计数的已定规则不变；TypeSafe 原始评估为该方案 44%，由用户决定，见 `typesafe-0116.json`。

## 失败记录存储的明确分歧

- Supplieroom：`LoginRateLimiter.attempts` 为进程内 Map，类内记录、清理、窗口计算均基于该 Map。
- Catchouse：`createAuthService` 内 `failures` 为进程内 Map，`limited/registerFailure/loginWithPassword` 读写及清理该 Map。
- Skoope：`exchangeLocalPassword` 使用 PostgreSQL 凭据表的 `failed_attempts/locked_until`，事务内行锁更新，成功后清零。

以上已读文件再次覆盖检查 metadata_match、未报告问题。内存记录不会跨进程共享或在进程销毁后保留；数据库记录可供使用同库的实例共享且应用重启不清除，实际并发更新须保留相应事务保障。若选数据库，只借用 Skoope 持久化和并发更新方式，仍按已定 IP+用户名及 Catchouse 时间策略设计，不复制账号级业务模型或改变已定时间参数。本次不创建表或执行 SQL。

## 存储决策

TypeSafe `typesafe-0117.json` 返回 PostgreSQL 97%、内存 1%、需要澄清 2%，按授权采用 PG 模式。保持已选计数键及 Catchouse 时间规则；本轮不涉及数据库结构或实际迁移。
