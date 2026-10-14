# T06 管理员网页账号与预定义角色合同

依据 Gitea #7/#1、ADR0009/0022/0028、T04认证可用性投影及T05会话合同，2026-10-15。

## 管理入口

正常登录后，具有 `accounts:manage` 的有效账号从账号页进入 `/admin`。网页和直接API都校验持久会话、账号状态、版本及当前权限；人员和明确授权Agent使用同一规则。普通用户、Pending和零角色不能访问管理链路。没有公众注册、测试登录或未经认证的授权接口。

列表清楚显示账号ID/名称、Pending/启用/停用、人员/Agent、责任人名称及ID、预定义角色。搜索只覆盖名称和账号ID，400ms停止输入后应用；状态/类型可筛选。采用呈现配置 `elements.pagination` 的默认数量和选项，默认10及5/10/15/20/25/50，参数有界、末页夹紧；没有提前实现通用排序/列表控件。失败显示不可用提示，不伪装成空账号列表。

编辑区显示目标和结果摘要，所有角色为项目既有定义，不建设自定义角色或业务范围编辑器。角色/状态改变后须重新明确勾选确认；保存中禁止重复保存、关闭编辑和其它管理操作。服务端仍校验确认，UI不是授权边界。Pending审批将目标置active并选择角色；active/零角色仍无业务权限。角色和状态授权变化均提升版本，旧会话失效，获授权后须重新登录。

## API与并发边界

- GET `/api/admin/accounts?q=&state=&kind=&page=&pageSize=`：名称/ID文字按字面匹配，返回安全账号DTO、预定义角色、总数/当前页/总页数。当前为交互请求，更新有效会话活动；未返回用户名、密码哈希、会话或部署秘密。
- POST `/api/admin/accounts/:id/authorization`：只接受 `roles:string[]`、`state:active|disabled`、`expectedVersion:string`、`confirm:true`，16KiB body上限。精确同源Origin，拒未知字段/无效值；浏览器不能提交actor、认证配置或可用性投影。
- 网页调用现有 `setAuthorization`，独占授权事务锁取得后，通过同一SQL客户端重新读取操作者会话及accounts:manage。不得用事务外的初次鉴权替代该校验；等待期间被CLI降权/停用/撤销的操作者无法继续变更。目标行锁及expectedVersion防止旧页面覆盖其它管理结果。
- CLI继续使用受信任宿主身份和认证可用性投影；API使用当前完整配置派生的非秘密身份域，不接收浏览器布尔开关。最后有效管理员计数、密码/Agent责任人规则沿用同一函数和锁。首次零管理员CLI初始化仍允许。
- 角色写入、状态、auth_version和关键授权审计同一事务提交。网页审计source为已验证会话的password/feishu，actor为 `account:<id>`，target和before/after均由后端读取。CLI仍记录cli及宿主操作者。

明确业务错误为400/404/409（invalid_management_input/account_not_found/account_conflict/role_conflict/last_admin）；已知审计/授权写失败返回503 management_save_failed，确认回滚且不给成功。数据库/网络或COMMIT结果不确定返回失败，页面提示重新查询并核对审计，不自动重试写操作。SQL、Cookie、密码和飞书密钥不进入诊断或响应。失败不清除Cookie；明确401仍按T05立即回登录。

成功响应在COMMIT确认后发送，带 `reloginRequired:true` 和 `selfChanged`。自身修改成功立即触发统一失效导航和标签页检查；其它账号变更显示成功并刷新列表。自身变更失败保留编辑并显示真实错误。强制导航沿用T05未保存守卫整合，网络/业务403不误退出。

## 项目互斥扩展

config/roles.json仍为schemaVersion1，默认仅admin/user且不互斥。新项目可在单个预定义角色添加可选 `excludes:[roleKey,...]`，只允许其它已定义角色，不允许自己、重复或未知角色。任一方向声明互斥就拒绝组合，Web/CLI共享 `validateRoleSelection`；未声明组合仍取权限并集，零角色无业务访问。配置错误拒绝启动/CLI操作；没有网页配置编辑器。

```json
"auditor": {"label":"审计人员","permissions":["audit:read"],"excludes":["user"]}
```

此例可与admin并存，但不能与user并存。config改动须按既有配置合同重启API；Web在受保护列表响应获取当前角色定义。配置属于项目文件，部署应协调CLI与运行API版本，不声称运行中热更新。

## 测试与边界

tests/account-management.test.mjs在隔离Postgres中覆盖真实SQL、HTTP和CLI，含正常密码登录、仅模拟外部飞书响应的Pending首登/审批/重新登录、事务审计故障、权限与版本、项目互斥、操作者锁等待以及网页/CLI并发最后管理员降权和停用。浏览器使用CLI新建独立受限文件凭据，真实页面操作；测试脚本只在checks/tools镜像，生产API无fixture入口。

不增加迁移或修改数据库历史。T03真实飞书组织验收仍另列；本票模拟外部响应不证明个人授权已完成。macOS Docker/Ego验证不替代Linux/WSL2矩阵。验收证据见docs/discovery/t06-acceptance.md。

Context7核对 [React effect清理与过期响应](https://react.dev/reference/react/useEffect) 和 [Fastify参数校验](https://fastify.dev/docs/latest/Reference/Validation-and-Serialization/)；采用手动严格字段校验，避免默认AJV removeAdditional静默删除未知字段。
