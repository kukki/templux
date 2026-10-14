# T08 已验证登录方式与管理员随机重置

依据 Gitea Swython/Templux #9/#1、ADR0024、T04/T05/T06/T07合同。2026-10-15实施选择如下；15分钟请求和5分钟新鲜登录为本票默认值，不冒充先前访谈决定。

## 关联合同

管理员从 `/admin` 人员编辑区发起请求；受控宿主CLI提供相同服务。请求固定人员ID、当前auth_version、方式和（密码方式）规范化唯一用户名，15分钟有效；同目标/方式的新请求取消旧请求。Agent不能关联。停用人员不可关联；Pending或零角色人员可以证明身份，关联不审批、不授角色。

| 目标方式 | 已有正常方式与证明 | 最终提交 |
| --- | --- | --- |
| 关联飞书 | 目标本人5分钟内正常密码登录，从账号页开始新的请求绑定飞书OAuth；一次性state和HttpOnly浏览器Cookie、仍有效的目标密码会话、允许组织/app/subject均通过后标记verified | 当前有效管理员确认；再次检查唯一性，不移动其它账号的身份 |
| 启用密码 | 目标已有当前部署飞书身份，本人5分钟内正常飞书登录并在账号页确认；不接收客户端subject、邮箱或姓名作为证据 | 管理员确认后系统随机生成密码；没有已启用密码，已有停用方式只能恢复原用户名 |

新鲜登录按持久会话created_at与数据库clock_timestamp计算，正好5分钟拒绝；普通活动/心跳不能刷新证明时间。请求过期（等于截止也拒绝）、取消、已完成、错误目标、错误正常登录方式、目标版本变化均拒绝。开始第二次关联OAuth会删除上一state的持久请求，旧回调不能退回普通登录路径。关联回调仅记录验证，不给新会话Cookie；普通OAuth仍按T03持久登录。验证后在请求有效期内管理员可最终确认，无需双方同时在线。

同人员的飞书、密码指向同一accounts行，状态、责任、角色及auth_version共用。姓名/邮箱不合并；provider/app/tenant/subject全球唯一，同person/provider/realm至多一个飞书身份。已有不同身份返回identity_conflict，需另行受控处理，不提供替换/解绑后门。验证姓名供管理员核对，不能替代服务端身份验证。

## 接口、事务与凭据

- GET `/api/admin/login-links?account=<id>` 当前管理员查询；GET `/api/account/login-links` 只查询当前身份自己的请求。最多25项，仅安全元数据，不返回subject、证明哈希、随机密码。
- POST `/api/admin/login-links` 固定accountId/expectedVersion/method/可选username/confirm:true；POST `/api/account/login-links/:id/feishu` 或 `/verify` 证明；POST `/api/admin/login-links/:id/complete` 最终确认。
- POST `/api/admin/accounts/:id/password-reset` 接受expectedVersion/confirm:true，只重置已有人员密码方式。系统randomBytes(32)密码及scrypt参数沿用T04；不接受自选密码、不提供自助改密、邮件/短信找回。保留enabled状态，不把停用方式意外启用。
- 写请求精确同源、明确确认、拒未知字段及有界body。Web初次鉴权可防无权KDF消耗，最终仍在独占authorization锁内，用同一SQL客户端重新验证操作者会话和accounts:manage、目标行/版本/请求状态/身份唯一性。等待期间降权或撤销不能继续提交。CLI以受信宿主身份执行，不收浏览器actor或配置投影。
- 请求、验证、最终关联、人员重置各自与关键审计同事务。最终关联/重置提升目标auth_version，所有旧密码和飞书会话立即失效，状态及角色保持。并发完成至多一次，跨目标抢同身份至多一个成功。审计故障确认回滚，不给凭据或假成功；数据库整体故障不放行。T07来源+用户名失败限制保持，重置不清除限制。

Web只允许对其他人员生成密码。本人密码启用/重置最终提交使用CLI，页面有对应ID可执行指令；本人关联飞书允许，成功依T05强制重新登录。此限制保证最后管理员不因前端会话检查抢先退出丢掉随机密码。

Web随机凭据仅在确认COMMIT后的单次HTTPS响应中返回，Cache-Control:no-store/Pragma:no-cache/Expires:0/nosniff，Next代理保留这些头。客户端将局部变量生成JSON Blob并请求下载，移除响应credential字段；不写React状态、DOM、URL参数、浏览器存储或普通日志，无再次读取接口。下载文件名为person-ID-credential.json。必须先选择操作者私有目录（建议0700）、核验下载完成并限制文件访问，再通过受控渠道交付目标，销毁多余副本。浏览器不能保证文件落盘/目录权限；页面只宣称提交及请求下载，不宣称安全交付已经完成。取消/丢失不能复取，核对审计后再次明确重置。

下载异常发生在COMMIT后时明确显示已提交但交付失败；重新刷新目标版本再明确重置恢复。网络/body读取或COMMIT结果未知不自动重试，先重新查询账号及关键审计，不把错误视为未提交。已确认回滚提示未提交。文件与SQL跨存储不能原子提交：CLI保留T04的fsync前提交规则，确认回滚清理本次文件，COMMIT未知保留文件供核对，不覆盖。异常退出留下文件需操作者核对后处理。

## CLI

```sh
./templux request-login-link --account <ID> --method feishu --confirm --non-interactive --json
./templux request-login-link --account <ID> --method password --username <唯一用户名> --confirm --non-interactive --json
./templux login-links --account <ID> --non-interactive --json
# 本人完成正常登录与账号页验证后，管理员最终确认：
./templux complete-login-link --request <请求ID> --confirm --non-interactive --json
./templux complete-login-link --request <密码请求ID> --credential-file 新文件.json --confirm --non-interactive --json
./templux reset-person --account <ID> --credential-file 新文件.json --confirm --non-interactive --json
./templux reset-agent --account <AgentID> --credential-file 新文件.json --confirm --non-interactive --json
```

菜单14–17和完整参数入口共用校验；只读login-links无需确认。密码完成必须指定受限目录新文件，缺失不提交。0600/host UID/GID、exclusive/O_NOFOLLOW、拒已有文件及符号链接、失败清理沿用T04，文本/JSON/诊断仅报告文件名及管理元数据，不打印密码。management仍只接收非秘密认证可用性投影，飞书域必须与API实际完整配置一致。最后有效管理员可以CLI安全重置自身，随机新密码完成写入并确认COMMIT后可正常重新登录。

## 迁移与协议

只新增不可变0006及身份域唯一索引。升级已有库仍遵守默认备份/历史校验；存在手工造成的同person/realm重复身份时迁移失败回滚，不能自动合并。请求表expiry索引供受控维护使用；本票不引入后台调度或业务范围模型。原用户环境0004未升级；隔离0005备份恢复、0006应用已验收，实际升级须另行安排。

2026-10-15读取完整官方[授权码](https://open.feishu.cn/document/common-capabilities/sso/api/obtain-oauth-code)、[token](https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/authentication-management/access-token/get-user-access-token-v3)、[用户信息](https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/authen-v1/user_info/get)。复用现有Confidential Client协议：v1授权页/client_id/response_type/注册redirect_uri/state，v3 token authorization_code+server secret，Bearer user_info严格组织域验证；不存远程token或秘密于关联表。PKCE为官方可选增强，本票保留既有协议，不增额外远程权限或刷新令牌。真实组织关联仍需用户正常授权及实际身份冲突验收，隔离外部协议模拟不替代真人验收，T03人工待办仍开放。

## T08 F1/F2修复合同

0007在OAuth持久state行新增purpose及login_request_id，普通登录与登录方式关联的用途由服务器写入，并有关系/枚举约束及FK索引。既有0006当前映射的关联state在迁移中回填，0001–0006保持不变。consumeOAuth用单条DELETE RETURNING在浏览器/state一次性校验与消费同时捕获用途、请求ID及当前映射；元数据缺失、不一致或伪装普通用途但实际映射关联的记录拒绝。不得在远程兑换后按“找不到映射”猜测为普通登录。

远程token/user_info调用在SQL事务外。关联用途回调兑换后按已捕获请求ID读取，再检查state当前匹配、pending、期限、版本及有效证明会话；替换、取消、过期、版本变更、请求缺失均拒绝，不注册Pending/发行普通会话。正常普通登录保持原合同，正常关联只标记verified。新请求重试须重新验证，身份已验证不等于已绑定目标或已授业务权限。

本人首次启用在未验证阶段只显示正常重新飞书登录/账号页证明步骤，不显示最终CLI命令。已verified的本人password请求用含真实requestId的 `./templux complete-login-link --request <ID> --credential-file person-<账号ID>-link-<ID>.json --confirm --non-interactive`，不显示必然409的Web完成按钮。本人已有密码重置继续显示 `./templux reset-person --account <ID> --credential-file person-<ID>-reset.json --confirm --non-interactive`。所有示例为合法ASCII文件名，文件已存在须另选新文件；不绕过证明/确认/受限文件规则。本人feishu关联以及他人已验证请求的Web完成保持原入口。
