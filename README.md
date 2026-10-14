# Templux

供新项目复用、也可独立启动的通用模板项目。基于 Supplieroom、Skoope、Catchouse 提取共通能力，业务与数据由各项目保有。

首版规格与29项实施任务已发布。当前已实现 T01–T08：容器启动、品牌配置、飞书首登Pending与CLI授权、人员/Agent密码、持久会话、管理员网页账号管理、持久密码失败限制及验证关联/管理员密码重置。真实飞书组织人工验收仍另列；导航、完整控件及其它后续任务尚未完成，不能视为完整首版。

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
