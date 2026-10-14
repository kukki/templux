# 三项目密码登录成功审计失败核对

## 范围

仅核对账号与会话本身可以正常处理、但成功登录审计写入失败时的行为。不讨论数据库整体不可用时是否还能登录，不扩展到飞书、登出、失败尝试事件或普通运行日志。已有账号、角色等关键管理变更必须可靠保存审计的决策保持。

使用图定位、调用追踪、精确符号和源码读取。证据文件覆盖均 metadata_match 且未报告问题；这是 best-effort 信号，不证明全库完整。未运行测试、未注入审计故障，来源文件未修改。

| 项目 | 现有密码登录链路行为 | 证据 |
| --- | --- | --- |
| Supplieroom | 登录响应已设置会话 Cookie，认证审计异步写入；catch 只记录运行错误，不使登录失败 | `src/app/api/auth/login/route.ts:94–107`；`src/modules/auth/application/auth-audit.ts:72–93` |
| Catchouse | `newSession` 后调用 `audit`，该函数捕获同步错误及 append promise 异步拒绝，仅运行日志报告，不向调用方抛出 | `server/auth.js:62–72,154–156` |
| Skoope | 登录事务内插入会话，再 await 审计数据库写入，通过后 commit；审计写入抛错进入 rollback，登录不成功 | `src/modules/auth/local.ts:86–104`；`src/modules/auth/agent.ts:37–58` |

图已追踪 Supplieroom `recordAuthenticationAudit` 的登录调用和实现、Skoope `exchangeLocalPassword` 到 `audit`；Catchouse 动态 store 调用未在图中完整连边，以直接函数源码补足。不能只看 await audit 的表象判断成功保证，Catchouse audit 自身吞掉错误。

## 明确分歧

Supplieroom/Catchouse 倾向保持认证可用、记录审计故障；Skoope 将成功会话提交和审计可靠保存绑定。本题只选择成功密码登录的行为，不改变管理变更规则，也不将所有认证日志一并扩大成同一策略。

## 用户决策

用户选择 Supplieroom/Catchouse 的登录成功审计单独故障不阻断方式。TypeSafe 原始概率 A 29%、B 5%、需要澄清 66%，见 `typesafe-0118.json`。此决定仅限已核对的密码登录成功事件，管理变更的强审计规则不变。
