# 三项目密码重置核对

## 范围与方法

核对源码中管理员密码重置、版本更新和会话校验链路；使用 codebase-memory Tier 2 定位、调用追踪、精确符号读取及覆盖检查，缺失调用边以精确源码补足。未运行来源项目或测试，未核实各部署数据库是否已经执行所有迁移，不宣称全量认证审计完成。来源项目未修改。

索引元数据：Supplieroom 2026-10-12T14:09:06Z；Skoope 2026-10-14T09:50:58Z；Catchouse 2026-10-13T12:58:32Z。下列文件覆盖检查均 freshness=metadata_match；Skoope 的 0009 SQL 报告部分解析缺口 39–42、60 行，已直接读取 15–63 行覆盖缺口，其余证据文件未报告覆盖问题。这是 best-effort 信号，不证明全库完整。

## 已核对证据

| 项目 | 密码产生 | 重置后的失效机制 | 证据 |
| --- | --- | --- | --- |
| Supplieroom | `resetSupplierPassword` 调用 `generatePassword` | 重置更新 `session_version + 1`；`loadActiveActor` 拒绝账号版本不匹配的会话 | `src/modules/auth/application/account-management-service.ts:210–225`；`src/modules/auth/application/authorization.ts:17–38` |
| Skoope | 管理操作使用调用方传入的密码；CLI 的 `passwordFromStdin` 接收隐藏终端输入或 stdin | 更新 `local_password_credentials.password_hash`，迁移中的触发器提升 `app_users.auth_version`；`resolveSession` 比较账号与会话版本 | `src/modules/auth/rbac-admin.ts:141–142,213–218`；`scripts/rbac-admin.ts:33–65`；`db/migrations/0009_human_local_auth.sql:50–58`；`src/modules/auth/agent.ts:146–203` |
| Catchouse | 网页管理入口随机生成新密码，CLI `reset` 也生成新密码 | 两入口均提升 `sessionVersion`；`checkSession` 读取账号并拒绝版本不匹配 | `server/index.js:471–481`；`scripts/accounts.js:58–66`；`server/auth.js:158–189` |

补充边界：Supplieroom 的仓储辅助方法 `PostgresAccountRepository.updatePassword` 仅更新密码字段及时间，不能单独作为旧会话失效证据；本结论依赖上表管理员重置应用服务及版本校验。Catchouse 的 `currentSession` 到 `checkSession` 调用已在图中追踪；Skoope 管理入口到 `performAccountMutation` 已追踪。未声称 Supplieroom 所有端点都实时调用 `loadActiveActor`，其前端对账时序见已有专门审查。

## 按用户新流程直接采用的共通规则

管理员密码重置应更新账号授权或会话版本，使该账号重置前的全部旧会话失效、重新登录。模板已有每请求最新数据库核验，按该语义执行；人员多登录方式共用账号版本，因此不会保留同账号旧飞书会话。不要求照搬来源的不同存储机制、业务字段或延迟。

## 明确分歧，交由 TypeSafe

人员新密码的来源：Supplieroom/Catchouse 由系统随机生成；Skoope 由管理员指定。选择只涉及人员密码的产生方式，具体交付方式另定。Agent 初始随机密码写受限文件的已确认决定不重开；不新增自助改密或邮件短信找回。

## TypeSafe 结果

`typesafe-0114.json`：随机生成 90%，管理员输入 2%，需要澄清 8%。按持续授权采用随机生成，仅决定人员密码来源，交付方式另定。
