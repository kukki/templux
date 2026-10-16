# 域名入口与启动环境合同（#31/#32）

## 入口与配置选择

- 统一入口：`./templux ...` 或 `docker compose -f compose.yaml ...`，始终复用已有Traefik/websecure/TLS与external网络。单文件已移除API/entry宿主端口，仅entry接已存在的external网络；不创建Traefik、证书、certresolver或公网端口，也不提供本地回环开发模式。
- `DOMAIN_NAME`是可选根域；`APP_HOST`是必填完整项目域名，例如`DOMAIN_NAME=example.com`、`APP_HOST=templux-uat.example.com`。Host路由只使用APP_HOST；提供根域时检查主机属于该域。`NETWORK_NAME`是实际外部网络名，不是本项目新网络。
- `APP_PUBLIC_URL=https://APP_HOST`，禁止路径/query/凭据。`TEMPLUX_PROJECT_NAME`使用独立、稳定、安全的Compose项目名（每个项目/UAT/PROD都唯一）；labels router/service由项目名+DEPLOYMENT_ENV生成并显式绑定entry内部8080、websecure、TLS。显式`-p`/COMPOSE_PROJECT_NAME必须与TEMPLUX_PROJECT_NAME一致，否则启动拒绝，避免内部管理编排误指向另一项目。不同项目必须有不同Host，不支持在两个项目争用相同Host。
- entry `/health/live`200只说明进程存活；维护未知/停服时域名页面503，入口不依赖Web存活。只有entry进入外部网络，API/Web/DB留在项目网络，无固定container_name。

## 来源头、Cookie与OAuth

沿用T07的Traefik→entry→Web→API链。`ENTRY_TRUSTED_PROXY_CIDRS`只能精确配置受信Traefik peer IP（推荐单个IPv4/32或IPv6/128），不自动信任整个共享网络。entry按实际socket peer及右向XFF逐跳核验，清理Forwarded/X-Real-IP/转发协议/来路stamp；Web仅接收明确entry peer的stamp，API仅信任明确Web peer。外部调用者不能靠伪造XFF/Origin绕过。代理重建IP变化时须重新核对并更新本项目配置，不能改成全网信任求方便。

HTTPS APP_PUBLIC_URL决定Secure会话Cookie和同源校验；不把caller的X-Forwarded-Proto当授权事实。启用Feishu时，APP_ID/SECRET及一个租户键均须完整，回调精确为`${APP_PUBLIC_URL}/api/auth/feishu/callback`。未启用时可全部空；管理容器仍不接收长期Feishu secret，既有可信可用性投影规则保持。

## .env.example元数据

每个键对应`# @env KEY POLICY public|secret`，共享代码和示例键/策略必须一致；移除、误名、缺注解或修改核心策略均报`example_drift`。复制示例不是生成生产凭据；真实值只在受限.env，不填回示例。

| POLICY | 语义 |
| --- | --- |
| required | 对当前作用域必须有效非空：项目名、部署环境、公开origin；迁移/救援不强制不相关origin |
| database | API/entry/管理/迁移需要DATABASE_URL；Web/probe不需要 |
| localDatabase | 全局校验中DATABASE_URL指向Compose的database时需明确本地密码；外部DB不要求本地密码 |
| domain | 所有服务作用域需要APP_HOST/NETWORK_NAME/精确信任peer（不再有本地可空分支） |
| feishu | API/probe/全局在配置了APP_ID或SECRET时条件必填；关闭可空，管理不要求secret |
| optional | 未设置、空串或仅空白可跳过；服务预载将空白optional作为未设置，复用原默认语义 |
| configured | 既有审计/日志6项与examples选择器：未设置使用已定默认，**显式空/空白仍拒绝**，保留T09/T10合同，不错误标成可空optional |

其他值域（数字范围、布尔等）继续由现有运行配置校验，不把env-check的赋值检查声称穷尽应用就绪。未知.env键只按名字告警，允许项目自有变量；核心.env.example完整合同不可悄改成放宽required。项目新增业务环境合同由项目自管，不能借未知键覆盖核心认证/授权。

## 解析与优先级

不`source`/`eval`。限定UTF-8、最多64KiB、无NUL；支持KEY=value、空白、注释、export、单/双引号及引号内换行；重复键/未闭引号/非法赋值行失败。Shell命令文字是数据，不执行。Node util.parseEnv读取示例/源文件仅作语法、漂移与来源比较，**不自行求值`${...}`**。

有效运行值由Compose求值：当前入口使用显式environment投影，宿主导出的同名变量优先于项目.env；未设置才采用公开的可选默认，必填无不透明默认。没有把项目.env作为全量env_file注入Web/API。若项目自行增加env_file，Compose的environment仍优先；本合同检查最终container environment，不猜测shell和env_file的不可观察细分来源。清单来源为`.env match`或`effective override or Compose projection`，不会错误宣称已精确识别宿主变量来源。若Compose进行变量展开导致与原文件文本不同，同样标作有效投影。

## 启动与诊断

Compose `environment`服务以受控root UID读取0600环境文件（不挂Docker socket、仅.env/.env.example两文件只读，无hostfs/可写挂载；应用API/Web仍非root），在容器读取只读项目目录中的.env/.env.example，输出脱敏报告；database/API/Web/entry依赖其成功。各应用服务NODE_OPTIONS预载固定作用域，再检查有效值及只读绑定的当前公开示例（镜像也附同源示例），不挂载私有.env给应用；直接`compose run --no-deps api ...`也先校验。受支持部署必须保留Compose给定的scope/preload；操作者主动覆盖entrypoint/NODE_OPTIONS不属本合同，也不是防恶意宿主的安全边界。

- `./templux env-check --json`：不需DB/Web；必填无效/文件不读/示例漂移返回非零，stdout单JSON，诊断stderr。
- `./templux env-list --json`：相同有效性退出码；列每个键的policy、required、visibility、missing/empty/blank/set及来源，**所有值都不输出**，包括public。无全环境dump、token、密码、异常原文。
- 无JSON时输出名字/状态列表；`./templux --help`说明入口与Traefik模式。直接容器：`docker compose run --build --rm --no-deps environment list --json`。
- wrapper与管理容器内部Compose使用同一`compose.yaml`。start在DB/迁移之前重跑全局环境校验；管理/迁移作用域不引入对飞书secret或数据库在线的诊断依赖，维护救援仍可在DB不可达时执行既有操作。

## 交付与验收边界

Root与project-template均包含单文件Compose、脚本、示例、Docker资源。旧正式0.1/T29锁定包完全不动；新本机候选/确切来源及新消费验证见[候选方案](../discovery/domain-environment-candidate-plan.md)及[验收](../discovery/domain-environment-acceptance.md)，不能只复制新Compose配旧包声称支持预载。

只读参考Catchouse `scripts/validate_env.sh`（必填/可选/未知键）、`server/config.js`（startup assert）、`.env.example`及Compose/Dockerfile；未读其真实.env。未照搬ERP/归档密钥/生产必选飞书、grep取首值、certresolver或源项目数据。

Ubuntu实际主机、用户已有Traefik/wildcardTLS/DNS/公网入口及真人Feishu仍未验；本机测试用自有Traefik Docker provider及自签测试TLS，不能冒称生产证书验证。用户执行指南见[Ubuntu测试](ubuntu-domain-testing.md)。
