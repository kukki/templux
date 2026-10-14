# Supplieroom 会话与权限变更核对

## 用户已明确的模板方向

参考 Supplieroom，加入心跳校验；账号权限或数据范围与登录时不匹配时，使旧会话失效并要求重新登录。核对后的 Q29.1 已确认 PostgreSQL 持久化会话及撤销信息，正常重启保留有效会话；该选择不改变权限变更失效要求。

后续范围澄清：模板不内置 Supplieroom 的供应商范围或通用业务范围模型。新项目拥有自身业务范围，可在变更时接入模板会话失效机制。下述供应商字段仅为来源分析，不能直接成为模板字段，见 [ADR 0023](../adr/0023-business-scope-owned-by-new-projects.md)。

## 已核对的来源链路

| 环节 | 来源与行为 |
| --- | --- |
| 登录时声明 | `src/modules/auth/infrastructure/encrypted-session.ts`：加密 Cookie 保存账号、会话版本、登录方式、角色、供应商范围与关联供应商等声明；最大有效期 12 小时 |
| 管理修改 | `src/modules/auth/application/account-management-service.ts` 的 `updateAccount`：更新账号并增加 `session_version`，随后替换供应商绑定 |
| 服务端授权对账 | `src/modules/workflow/runtime/workflow-runtime.ts` 的 `reconcileAuthorization`：独立周期读取账号与授权记录，生成快照并对账；示例配置 `WORKFLOW_RECONCILE_SECONDS=60`，为源码示例值，不代表实际环境值 |
| 比对内容 | `src/modules/auth/application/authorization-reconciliation.ts`：账号须 ACTIVE 且有角色；比较会话版本、登录方式、角色、供应商范围与授权供应商集合；角色及 ID 先排序去重，纯顺序变化不撤销 |
| 会话撤销 | `src/modules/auth/runtime/session-presence.ts`：权限快照不匹配或账号不再可用时，将已观察的会话标为 REVOKED；后来出现的旧会话也会与快照比对 |
| 请求检查 | `src/modules/auth/http/current-session.ts`：受保护请求读取会话时检查到期、闲置/撤销状态、授权比对及快照新鲜度，不只依赖前端是否跳转 |
| 心跳 | `src/modules/auth/ui/session-guard.tsx`：进入页面时发送 presence，此后每 30 秒调用 `/api/auth/presence`；收到 401 跳转登录页，闲置失效走相应退出路径 |
| 独立背景验证 | 同 `SessionGuard` 每 5 分钟调用 `/api/auth/verify-session`；无效时提示并启动 60 秒退出倒计时，可立即重新登录。此路径与 30 秒心跳收到 401 直接跳转不同 |
| 快照失效边界 | `src/modules/auth/runtime/authorization-reconciliation-state.ts`：超过两个对账周期没有成功更新授权快照，按陈旧处理并拒绝会话 |
| 实时账号读取辅助 | `src/modules/auth/application/authorization.ts` 的 `loadActiveActor`：从仓库读取当前账号与授权范围，检查 ACTIVE、有角色及会话版本；不能由此声称已审计所有业务接口的调用覆盖 |

权限变化通常在下一次成功服务端对账后撤销，随后请求被拒绝，前端在心跳或其它检查时获知。30 秒心跳不等于数据库权限修改后 30 秒内必定生效；总延迟还受对账、查询、网络和浏览器调度影响。示例 60 秒对账及 30 秒心跳仅为已核对来源的配置，不自动成为模板固定指标。

## 重启行为与存储位置

Supplieroom 不是纯粹的“数据库会话”或“内存会话”：授权声明放在加密 Cookie，presence、撤销和对账快照放在本进程状态，账号及授权事实在 PostgreSQL。

`src/modules/auth/infrastructure/encrypted-session.ts` 派生加密密钥时混入 `getStartupId()`；启动 ID 的实现位于 `src/modules/auth/infrastructure/startup-id.ts`。因此正常容器重启也会使全部旧 Cookie 无法解密，需要重新登录。不能把这种重启策略与权限变化强制退出混为一谈。

核对后用户已选择在 PostgreSQL 中持久化会话与撤销信息，同时沿用权限不匹配即失效的行为，不沿用来源重启即退出策略。见 [ADR 0021](../adr/0021-persistent-revocable-sessions.md)。

## 核对限制

使用 codebase-memory 定位符号、追踪授权对账链路并读取精确源码，检查所依赖代码与文档路径的覆盖。相关代码路径无已记录覆盖问题且元数据匹配；`.env.example` 报告第 302 行解析缺口，已直接读取该行，且本文示例配置值由字面量读取核对。覆盖信号是 best-effort，不代表所有接口调用均已审计。

本轮仅作源码与文档核对，未修改 Supplieroom，未执行权限变更、心跳或重启的浏览器验收。模板的心跳默认值、即时请求校验策略及退出提示仍需细化，会话持久化方向已由用户确认。
