# Templux

供新项目复用、也可独立启动的通用模板项目。基于 Supplieroom、Skoope、Catchouse 提取共通能力，业务与数据由各项目保有。

首版规格与29项实施任务已发布。当前已实现 T01–T14：容器启动、品牌配置、飞书首登Pending与CLI授权、人员/Agent密码、持久会话、管理员网页账号管理、持久密码失败限制、验证关联/管理员密码重置、审计查询/日志留存、受保护控件示例入口、统一搜索/只读列表、整行多选列表筛选、分页/三态排序/刷新恢复及普通表单/未保存离开保护。真实飞书组织人工验收仍另列；导航、完整控件及其它后续任务尚未完成，不能视为完整首版。

## 启动

宿主只需 Docker、Compose 和基础 Shell；Linux、macOS 使用下列入口，Windows 通过 WSL2 使用。

```sh
./templux
```

无参数且有终端时进入容器内菜单。自动化使用完整命令：

```sh
./templux start --non-interactive --json
./templux status --non-interactive --json
./templux typecheck --non-interactive --json
./templux test --non-interactive --json
./templux logs --non-interactive
./templux stop --non-interactive --confirm --json
```

默认页面为 http://localhost:31000，公开状态 API 为 http://localhost:31800/api/status。端口绑定本机回环地址，不占用已有的3000或8080服务；数据库不发布宿主端口。停止保留数据库卷。

启动顺序为构建前后端、启动数据库、一次性管理容器迁移并校验、启动应用并等待健康。迁移失败返回非零，不执行后续应用启动。普通重启检查已有迁移，不重复应用；Web 不自行修改结构。

JSON 模式 stdout 仅一个结果对象，构建进度及诊断不混入结果；错误返回非零。无终端、JSON或非交互模式缺命令立即失败，不等待输入。停止须显式确认。`--interactive` 可明确要求交互终端，不可与 JSON 或非交互同用。

## 项目品牌与呈现

复制源码后使用容器内初始化设置新项目品牌，已有配置须显式确认覆盖：

```sh
./templux init --name '我的项目' --brand '我的品牌' --theme dark-brown --overwrite --confirm --non-interactive --json
./templux config-check --non-interactive --json
```

也可从无参数菜单选择7，查看目标并确认写入。修改 `config/presentation.json` 中已有公开呈现值后，执行 `docker compose restart api web` 即可生效。Logo 新资产与源码改动需重新构建。配色、页头页脚、版权版本、集中文案及管理显示时区的合同与覆盖规则见 [项目呈现配置](docs/specs/project-presentation.md)。`.env` 保存部署环境与秘密，与公开呈现配置隔离。

## 飞书登录与首位授权

登录入口为 `/login`。配置 `FEISHU_APP_ID`、`FEISHU_APP_SECRET`、`FEISHU_TENANT_KEY`，在飞书自建应用登记 `http://localhost:31000/api/auth/feishu/callback`；其它部署通过 `APP_PUBLIC_URL` 与可选 `FEISHU_REDIRECT_URI` 设置同源回调，生产使用HTTPS。本人完成允许组织的真实飞书授权后为Pending，宿主操作者可通过菜单9/10或完整命令查看并授予角色：

```sh
./templux users --non-interactive --json
./templux authorize --account 1 --roles admin --confirm --non-interactive --json
```

初始管理员不会自动授予；CLI与审计同事务，最后有效管理员受到保护，授权变化使旧会话失效，须重新登录。当前预定义角色及认证文案分别在 `config/roles.json`、`config/auth-copy.json`。协议、配置命名、权限边界与真实验收步骤见 [飞书认证合同](docs/specs/feishu-authentication.md)。

## 当前开发配置

可复制 `.env.example` 为 `.env`，修改项目名和端口，或配置外部 PostgreSQL 的完整 `DATABASE_URL`。内置数据库默认凭据仅用于本机开发；更改内置密码时须同步完整连接地址，已有数据库卷的密码不会因修改环境变量自动变化。外部连接配置不会自动迁移已有数据。

管理容器使用宿主 Docker socket 执行部署动作，遵从宿主运维授权；该 socket 不挂载到前端或后端服务。前后端以非 root 用户运行。当前公开页面只显示非敏感状态，不公开连接地址；账号管理接口仅限已验证且获授权的管理员。

## 验证

`typecheck` 和 `test` 在容器内执行，使用真实 HTTP 与管理 CLI 边界，不要求宿主 Node、npm 或数据库客户端。普通测试前先启动当前开发安装；test自动启动隔离auth-database（tmpfs），不得将测试指向部署数据库，用后可 `docker compose rm -s -f auth-web auth-browser auth-database` 清理工具服务；不要将开发验收入口当作生产测试调度。

数据库不可用场景另在隔离验收环境暂停数据库后执行：

```sh
docker compose stop database
docker compose run --rm --no-deps checks node --test tests/scenarios/database-unavailable.test.mjs
docker compose up -d --wait database
```

故障演练后须恢复数据库。浏览器截图及测试临时产物写在忽略的测试结果目录。跨平台完整验收、真实飞书和全首版矩阵由后续任务完成，不以本次本机 Docker 验证替代。

`./tests/schema-drift.sh` 在自动清理的独立 Compose 项目中验证应用 schema 丢失会被公开迁移检查拒绝，不修改当前数据库。当前测试的 PostgreSQL 为18.6，Compose 同时锁定镜像摘要。

## 项目文档

- [首版规格](docs/specs/templux-v1-prd.md) / [父规格 Issue #1](https://gitea.whynots.top/Swython/Templux/issues/1)
- [29项任务与验收条件](docs/discovery/templux-v1-ticket-plan.md) / [任务发布记录](docs/discovery/ticket-publication.json)
- [领域术语](CONTEXT.md) / [架构决策](docs/adr/) / [Issue tracker](docs/agents/issue-tracker.md)

共享改进经审查反哺模板，项目升级由维护者确认应用；不自动同步业务、合并或部署。

### 受控密码账号与 Agent（T04）

宿主运维可用菜单11/12创建人员或关联责任人的Agent，菜单13重置Agent密码。完整参数与受限凭据文件交付见 [密码认证合同](docs/specs/password-authentication.md)。创建默认零角色，须另用 `authorize` 明确授权；经正常 `/login` 密码页验证，普通用户和明确管理员使用同一后端权限检查。

`DEPLOYMENT_ENV` 缺省 `PROD`，Agent默认不能登录；DEV/UAT默认允许，`AGENT_LOGIN_ENABLED=true/false`显式覆盖，开关不授予角色。密码及Agent配置独立于飞书密钥，既有组织飞书验证继续有效。人员关联/重置及持久化失败限制的实现合同见下方T08/T07。T03真实组织个人授权仍由单独验收跟踪。

### 会话生命周期（T05）

账号/受保护页面支持当前及全部退出；服务端持久撤销，正常重启保留有效会话。可见在线默认30秒检查，`HEARTBEAT_INTERVAL_SECONDS`可配置，后台心跳不续闲置；明确会话失效立即回登录显示原因，网络/业务403保留登录。业务范围接入、交互活动和未保存整合合同见 [会话生命周期](docs/specs/session-lifecycle.md)。

### 网页账号管理（T06）

有效管理员从 `/account` 的“管理账号”进入 `/admin`，查询人员/Agent、审批Pending、分配预定义角色及启停。页面明确展示责任人、目标状态与角色，核对并勾选确认后保存。保存使目标旧会话失效，须重新登录；最后有效管理员保护、事务审计及权限规则与CLI共享。项目角色可用 `excludes` 声明互斥，默认admin/user保持并集。详见 [账号管理合同](docs/specs/account-management.md) 与 [验收记录](docs/discovery/t06-acceptance.md)。

### 密码失败保护（T07）

同来源IP和规范化用户名，首次失败15分钟内第5次失败触发从触发时起固定15分钟限制；受限提交不延长，到期正常重新尝试，成功仅清理该组合。限制存Postgres，重启/多实例共享；页面和API统一失败反馈。新增0005迁移前已有库须先备份。Web使用可靠socket入口，API仅接受受信Web实例的来源标记，外部TLS代理须显式配置 `WEB_TRUSTED_PROXY_CIDRS`；禁止信任任意客户端XFF。来源、清理、迁移及恢复步骤见 [失败限制合同](docs/specs/password-failure-limits.md)。

### 验证关联与随机重置（T08）

管理员从人员编辑区发起请求，目标本人正常重新登录并验证后再由管理员最终确认。请求15分钟有效，身份验证须在正常登录5分钟内；姓名/邮箱不合并，身份/用户名占用拒绝。人员飞书与密码共享账号状态、角色及版本，关联或重置使所有旧方式会话失效，不清除T07失败限制。Agent仍独立，通过CLI受限文件重置。

网页他人随机密码只在本次no-store响应请求下载，请确认私有目录保存完成再受控交付；取消/丢失不能复取，需要再次明确重置。本人密码变更使用 `./templux reset-person --account <ID> --credential-file 新文件.json --confirm --non-interactive`，防止会话失效抢先丢掉密码。菜单14–17及关联命令见 [登录方式合同](docs/specs/login-methods.md)；隔离0006/0007、SQL/HTTP/CLI/网页证据见 [T08验收](docs/discovery/t08-acceptance.md)。原真人授权环境仍0004，升级须另行备份与安排；T03真实组织人工验收仍未完成。


### 审计查询与日志留存（T09）

管理员从账号管理页进入 /audit，查询真实认证与管理事件，按事件/操作者、来源、目标账号、结果和含时区时间筛选，分页查看。人员/Agent责任快照、应用身份、宿主CLI声明与历史未知身份分别显示；后端要求账号管理及审计读取权限，页面只读、不提供导出或运行日志浏览器。

审计默认保留90天，由API启动及每小时执行有界清理；清理删除与摘要审计同事务。AUDIT_RETENTION_DAYS、AUDIT_CLEANUP_INTERVAL_SECONDS、AUDIT_CLEANUP_BATCH_SIZE、AUDIT_CLEANUP_MAX_BATCHES可覆盖。API/Web运行日志仅保留安全结构化诊断；Docker每容器默认10MiB×10份，三长期服务约300MiB预算，约14天为目标，容量先到可更早淘汰。RUNTIME_LOG_MAX_BYTES与RUNTIME_LOG_MAX_FILES控制轮转，工具容器另有自身预算。

通过 ./templux logs --json --non-interactive 或 Docker Compose日志查看；JSON结果在stdout，日志/诊断在stderr。具体字段、脱敏、逐类故障行为与配置范围见 [审计与运行日志合同](docs/specs/audit-and-runtime-implementation.md)，隔离0008、真实轮转及查询证据见 [T09验收](docs/discovery/t09-acceptance.md)。原真人环境仍0004，未应用本票迁移或重建日志配置；正式升级须另行备份、安排。


### 受保护控件示例（T10）

DEV/UAT默认从账号页进入 /examples，PROD默认关闭；COMPONENT_EXAMPLES_ENABLED=auto/true/false可配置，空值/非法开关及部署环境明确拒绝。只有正常登录、有application:read角色且符合Agent环境策略的账号可访问；示例不会授予管理权限。

三条合成数据可在页面内试改和重置，刷新恢复，不保存正式数据、不新增业务API或表。当前展示项目元素默认值与最小内存体验，完整控件演示随T11–T20交付。新项目可先设false，再删除apps/web/app/examples与config/examples-copy.json并重建Web；真实认证、管理、审计不依赖示例模块。具体默认/必填/可选扩展及移除合同见 [示例实现合同](docs/specs/component-examples-implementation.md)，容器/配置矩阵/物理移除/浏览器证据见 [T10验收](docs/discovery/t10-acceptance.md)。


### 统一搜索与只读列表（T11）

/examples新增名称/编号搜索及五列只读合成列表。搜索字段、读取/匹配实现由采用项目显式提供，默认整段trim、忽略大小写、任一指定字段包含；400ms停顿、清空/Enter及中文输入按合同触发。加载、读取失败、无资格与成功空结果分开，空结果保留表头和搜索；窄屏只在表容器横滚。异步旧结果在新输入意图产生时失效，不等新请求发出。

通用组件位于components/elements，不依赖examples；fields/matches/load及列/稳定ID必填，无默认全字段搜索或业务API。呈现配置elements.search可完整覆盖delayMs和showButton，旧文件未写分支补400/false；1–1000ms、按钮默认隐藏，已有值重启加载。详见 [搜索与只读列表合同](docs/specs/search-and-readonly-list.md) 和 [T11验收](docs/discovery/t11-acceptance.md)。普通表单见下述T14合同，表格行编辑按后续票交付。

### 多选与列表筛选（T12）

整行checkbox/文字/空白可点击，原生键盘勾选；立即显示草稿，列表停顿默认1秒或关闭立即应用。下拉搜索与全选当前结果保留隐藏选择，全选不额外限制、空选无结果。基础MultiSelect为受控控件，表单/显示字段自行选择提交时机；ListMultiSelect提供列表适配。elements.multiselect可完整覆盖delayMs（1–1000），旧文件缺省1000，显式非法拒绝；重启加载。与名称/编号搜索组合的合成样例见受保护/examples，长文本与窄屏浮层保持视口边界。详见 [多选合同](docs/specs/multiselect-and-list-filter.md) 与 [T12验收](docs/discovery/t12-acceptance.md)。

### 分页、排序与刷新恢复（T13）

显式采用PagedList/view后提供默认10条及5/10/15/20/25/50、完整分页和合法页码下拉。名称/编号示例排序支持升/降/基础三态，表头与下拉同步，排序/数量改变回1；page/pageSize/sort写地址并replace当前历史，刷新恢复且校验规范化。窄屏直接保留上页/位置/下页，其余可展开。旧pagination分支缺controls补默认全显示；项目可完整配置五项可选入口。53条纯合成数据及53/12/0情景支持组合/收缩/空验证，无业务API/表。详见 [分页排序合同](docs/specs/pagination-sort-url.md) 与 [T13验收](docs/discovery/t13-acceptance.md)。

### 普通表单与未保存编辑（T14）

普通字段名称持续显示在上方，首次失焦/提交校验，错误修改及时复查。`useEditor`/`createEditor`提供规范化dirty基线、字段/表单错误、保存快照与晚返回失效；`EditNavigationProvider`/`requestLeave`接入站内导航与会话强制退出。浏览器原生离开提示受平台限制，未接入的同文档历史遍历不保证拦截。受保护`/examples`提供纯内存成功/错误/延迟保存、保留与放弃；真实消费者仍需服务端最终校验。详见 [表单与离开保护合同](docs/specs/forms-and-unsaved-edits.md) 与 [T14验收](docs/discovery/t14-acceptance.md)。
