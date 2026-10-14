# Templux

供新项目复用、也可独立启动的通用模板项目。基于 Supplieroom、Skoope、Catchouse 提取共通能力，业务与数据由各项目保有。

首版规格与29项实施任务已发布。当前实现为 **T01：容器启动与真实状态页**，认证、账号管理、项目变体及控件示例尚在后续任务中，不能视为完整首版。

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

## 当前开发配置

可复制 `.env.example` 为 `.env`，修改项目名和端口，或配置外部 PostgreSQL 的完整 `DATABASE_URL`。内置数据库默认凭据仅用于本机开发；更改内置密码时须同步完整连接地址，已有数据库卷的密码不会因修改环境变量自动变化。外部连接配置不会自动迁移已有数据。

管理容器使用宿主 Docker socket 执行部署动作，遵从宿主运维授权；该 socket 不挂载到前端或后端服务。前后端以非 root 用户运行。当前公开页面只显示非敏感状态，不公开连接地址或管理接口。

## 验证

`typecheck` 和 `test` 在容器内执行，使用真实 HTTP 与管理 CLI 边界，不要求宿主 Node、npm 或数据库客户端。普通测试前先启动当前开发安装；不要将开发验收入口当作生产测试调度。

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
