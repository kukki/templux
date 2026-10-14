# T04 人员与 Agent 密码认证合同

核对日期：2026-10-15。依据 Gitea #5/#1、ADR0005–0008、0024、0028。实施细节为本票选择；没有将其伪称为访谈已选定。

## 身份与凭据

人员和 Agent 使用独立 accounts.kind，Agent 必须关联已启用人员责任人。创建人员或 Agent 均为 active/零角色，可验证身份但无业务权限；经原有 authorize 明确授予角色，多角色取并集。没有公众注册接口，没有复用员工凭据或短期换票入口。

密码由系统用 randomBytes(32) 产生，256位随机性。异步 Node scrypt N32768/r8/p3，64MiB maxmem，16字节随机盐、64字节结果，使用带版本 scrypt-v1 编码和 timingSafeEqual 比较。用户名去首尾空格、转换ASCII小写，允许3–80位字母/数字/点/下划线/连字符，唯一约束跨人员和Agent。密码不修剪、不存明文，输入上限1024字节，HTTP JSON上限4096字节。未知/停用/错误凭据使用相同invalid_credentials提示，未知合法用户名仍执行同参数派生。

API固定正常POST `/api/auth/password`，只接受username/password及精确同源Origin。Next同源代理不转发调用者伪造身份，HttpOnly/SameSite=Lax Cookie；HTTPS时Secure，HTTP仅环回主机。外部公开域须APP_PUBLIC_URL使用HTTPS，跨站登录POST拒绝。TLS终止代理部署由操作者维护，不在本票信任任意转发头。

密码凭据只存哈希与enabled；会话仍为随机256位token的SQL哈希，持久化、授权版本、最长/闲置期限和撤销复用原有实现。会话method区分feishu/password：飞书每次检查当前组织/App ID，密码不假设组织身份也不依赖飞书密钥；每次访问检查当前密码方式enabled。人员默认最长43200秒/闲置600秒。授权及Agent重置提升版本、旧会话失效。

## Agent 环境与归属

DEPLOYMENT_ENV为DEV/UAT/PROD，缺省PROD。DEV/UAT默认可登录Agent；PROD默认拒绝。AGENT_LOGIN_ENABLED空使用环境默认，明确true/false独立覆盖，拼写错误使启动/操作拒绝。环境开关不授予角色，admin必须另行明确授予。AGENT_SESSION_MAX_SECONDS/AGENT_IDLE_TIMEOUT_SECONDS分别默认43200/600，独立于人员，整数60–604800秒。

登录和每次会话请求均检查Agent开关、责任人仍为active人员。关开关或禁用责任人后旧Agent会话不再放行。role长期有效直到撤销/禁用，不使会话永久有效。最后有效管理员计数同时考虑当前飞书身份、可用密码方式、Agent环境与责任人；在同一个授权锁/事务中检查变更前后，禁用最后Agent管理员的责任人也会被拒绝。环境修改本身仍由部署管理员负责保持可用管理员。

## CLI 与受限文件

宿主运维权限与浏览器admin/Agent角色不同。沿用受控管理容器、CLI来源和host-uid审计。下面命令不含实际凭据：

```sh
./templux create-person --username invited-person --name '受邀人员' --credential-file invited-person.json --confirm --non-interactive --json
./templux create-agent --username qa-agent --name '验收Agent' --owner <person-id> --credential-file qa-agent.json --confirm --non-interactive --json
./templux authorize --account <account-id> --roles user --confirm --non-interactive --json
./templux reset-agent --account <agent-id> --credential-file qa-agent-reset.json --confirm --non-interactive --json
```

菜单11/12/13采用同一校验。完整参数直接执行；菜单/显式interactive补齐，展示目标、责任人、文件及零角色/重置会话影响，输入yes确认。非交互缺参数或confirm立即失败，--overwrite不适用。

指定 `--credential-file` 是专用受限目录内的JSON文件名（不可传目录/路径穿越）。管理容器只将宿主TEMPLUX_CREDENTIAL_DIR（默认./credentials）挂到/opt/templux/credentials，部署API/Web不挂此目录。建议操作者预建本人可读写的0700目录；文件写username/password，exclusive create+O_NOFOLLOW，0600和宿主UID/GID，fsync后提交数据库。文本/JSON/诊断不打印密码，输出仅文件名、账号和管理结果。已有文件或符号链接拒绝，不覆盖。目录已从Git和Docker上下文排除；自定义目录须由部署自行排除/保护。操作者通过受控渠道交付本人/Agent，读取时避免共享终端日志，及时移走或销毁交付副本。

管理创建、凭据、状态版本与关键审计同一SQL事务。确认回滚时删除本次文件，不修改已有文件。COMMIT异常可能是结果未知，保留已写受限文件并提示核对账号/审计后处理，不自动重试、不宣称绝未生效。文件与SQL无法跨存储原子提交，进程中断可能留下未关联文件；文件存在则下一次创建拒绝，操作者须查users和审计后手工清理，不能自动覆盖。文件系统不可写/属主或权限无法设置时不执行账号变更。

## 审计与后续关联合同

创建/重置/角色变更审计失败回滚，CLI明确失败。身份、账号和SQL会话已正常验证保存后，成功登录审计单独失败不阻断登录，记录无敏感值的login_audit_failed；整体数据库不可用或会话提交失败返回503，不给登录Cookie。

T04只创建独立人员密码账号，没有启用现有飞书账号密码或按姓名/邮箱自动合并。T08将实现仅管理员发起、双方身份验证、唯一性冲突、同一人员共用状态/角色/审计与版本的关联及人员随机重置。Agent始终独立，不关联人员登录方式。T07负责已确认的持久化IP+规范用户名失败限制；本票未声称该限制已实现，正式暴露公共密码入口前应完成T07。T05负责全部退出、心跳与完整闲置前端交互，当前服务端已有期限检查。

正常 `/login` 密码表单验证；账号页展示身份/责任人/角色，受保护页验证application:read；管理员验收页 `/admin` 及 `/api/admin/access`只证明accounts:manage检查，无账号管理操作（T06）。普通user无法访问该页/API，Agent也必须明确admin角色。

## 官方文档

Context7先resolve Node.js，再读取v24当前文档，采用[crypto.scrypt/timingSafeEqual](https://nodejs.org/docs/latest-v24.x/api/crypto.html)及[fs exclusive open/fchmod/fchown/fsync](https://nodejs.org/docs/latest-v24.x/api/fs.html)。没有增加第三方密码库或ORM。
