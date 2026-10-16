# #31/#32 域名与启动环境验收

> 后续变更（模板单文件Traefik化）：`compose.traefik.yaml`已合并进`compose.yaml`并删除，本地回环开发模式移除，入口始终复用已有Traefik；`TEMPLUX_TRAEFIK`与`TEMPLUX_ACCESS_MODE`不再使用。本文以下关于overlay、`TEMPLUX_TRAEFIK=1`与local/traefik双模式的记录是变更前的历史验收证据，保留备查；现行合同见 [域名与环境](../specs/domain-and-environment.md)。

## 当前交付与边界

工程基线 `77c73c73acf1516261d283c7326e0cab0205c8e8`。最终产品源码 `29ce8e79288a74571e5a9b57dd23af7b930e7791`；之后仅交付文档、测试驱动和证据，不把文档提交冒充更早镜像内容。实现合同见 [域名与环境](../specs/domain-and-environment.md)，用户可执行步骤见 [Ubuntu测试指南](../specs/ubuntu-domain-testing.md)。

模板root和真实包消费者均已使用自有Traefik Docker provider完成域名/TLS/维护/密码权限验证。启动支持必填/条件/可空optional、既有configured空值拒绝、示例漂移与脱敏清单；诊断门禁短命root仅挂载两个只读文件，应用仍node。公开环境示例已贯通升级/发现，真实运行.env不进入提案。

**仍未执行**：真实Ubuntu主机（版本/架构待环境）、用户现有Traefik/真实DNS/wildcard证书/公网入口、本人授权Feishu。自有TLS使用默认自签证书并仅测试客户端放开验证，不冒称生产证书通过；Ubuntu指南不放开验证。macOS Docker Desktop Linux容器不是Ubuntu宿主。#31/#32待独立审查，#30/父#1/T03不因本轮自动完成。没有push、registry发布、生产部署、原环境操作或消息外发。

## 实现与来源

- `compose.traefik.yaml`及project-template同名overlay：仅entry接既有NETWORK_NAME，Host取完整APP_HOST，DOMAIN_NAME保留根域语义；项目+环境router/service明确绑定8080/websecure/TLS；移除API/entry宿主端口，无container_name/certresolver/新证书或新Traefik配置。
- common环境投影/作用域预载、`environment`短命门禁及host `env-check/env-list/--help`，wrapper与内部管理编排选择同一overlay。`TEMPLUX_PROJECT_NAME`与实际Compose项目不一致拒绝，避免显式-p指向另一个管理项目。
- 诊断root无socket/privileged/hostfs/可写挂载，仅.env/.env.example两文件RO且禁止自动创建宿主路径；应用只绑定公开example、通过环境投影取得所需运行值。无真实.env放入image/Web或HTTP诊断接口。
- 只读参考Catchouse `.env.example`、`scripts/validate_env.sh`、`server/config.js`及Compose/Dockerfile。复用必填/可选/未知键与startup assert，不照搬ERP/归档密钥、生产强制Feishu、grep首值、certresolver；未读其真实.env或修改来源。
- 使用codebase-memory search→trace→snippet、逐文件coverage；新/改文件和排除的test-results直接读源码。Context7核对Compose插值/优先级/!reset相关入口、Traefik显式service/port/network、Node24 parseEnv/预载。SQL测试前加载Postgres技能；产品SQL/迁移历史无修改。

## 准确候选批次（仅本机）

旧正式0.1、T28及T29归档/锁/包保持原字节。没有用新Compose覆盖旧vendor就声称支持。版本与来源/许可记录见 [候选方案](domain-environment-candidate-plan.md)。

| 批次 | 来源 | 实际范围 |
| --- | --- | --- |
| `0.1.3-domain.1` | `59ad67b` +唯一版本overlay | 初始新包消费者实际16场景；尚含独立报告F1，不冒称含后来修复 |
| `0.1.3-domain.2` / `0.1.4-domain.1` | `412d1c7` +已核版本/from/公开默认overlay | F1完整合法边、目录catalog/discovery、外部apply；211相关/types固定点 |
| **`0.1.3-domain.3` / `0.1.4-domain.2`** | **`29ce8e7`** +已核v3 overlay | 最终新消费者、权限/JSON修订、最终合法边和211/types，见下 |

最终current不声明from；target仅声明from `0.1.3-domain.3`，公开样板heartbeat默认30→45为真实测试差异。它不改变产品默认30，不是假兼容旧项目或仅更版本。compat原数字保持不代表所有旧项目无迁移兼容。

最终安全产物根：`test-results/domain-environment/v3/`。

| 标识 | SHA256 / ID |
| --- | --- |
| 工具镜像（同源updates-tools标准target） | `sha256:518eccc36db6c6c8cbf98087be6fc34ea96daaa080e5b0c12557b19f76f3caf7` |
| current manifest | `747529ab72a8426b062f307d7087f9b1f0be34c3f9cb8658252e32a0c236dd3c` |
| target manifest | `a97f715472c1c967461f126f2ad6e0b83748816bd2ce4434d2f034936a63bf9c` |

`v3/plan.json`与`release-proof.json`给出精确source archive、四overlay、两批包/完整project/锁/exports/SQL资源的SHA及mode；`*-generate.json/log`是真实命令和exit0。两源码包版本统一，应用业务版本仍独立1.0.0。不同批次不覆盖同版本文件。

## 真实执行矩阵

证据根 `test-results/domain-environment/`；脚本均在 `tests/scenarios/`，不需宿主Node/npm/PG。以下将最终实跑和前一固定点分列，不冒称所有历史测试在最终源码重跑。

| 验证 | 命令/驱动 | 实际结果 / 来源 |
| --- | --- | --- |
| 必填缺失/空/空白、条件飞书、外部DB、Host/origin/CIDR、示例、重复键、multiline/quote、惰性shell文字 | `node --test tests/environment.test.mjs`（Node24容器） | 最终37项；与公开边界15项合计52/52；明确RED→GREEN日志保留 |
| root/project有效Compose、本地/域名模式、shell覆盖、无宿主端口、JSON状态/无值、预载拒绝、示例漂移、管理JSON错误 | `python3 tests/scenarios/domain-environment.py` | 11实际配置/容器场景通过；stdout单JSON，业务marker不执行 |
| Linux真实UID权限与投影 | `python3 tests/scenarios/domain-env-permissions.py` | tmpfs UID1001:1001/0600；node1000直接读取拒绝，root诊断成功；node1000只用公开example/环境投影预载成功。不是Ubuntu宿主证明 |
| 根模板最终域名闭环 | `DOMAIN_EVIDENCE_DIR=.../final-root python3 tests/scenarios/domain-traefik.py` | 18实际场景，产品29ce工作树+输入SHA；exact image ID/源inventory及清理见final-root JSON |
| 最终**真实锁包消费者** | `DOMAIN_CONSUMER_SOURCE=.../v3/releases/0.1.3-domain.3/project DOMAIN_EVIDENCE_DIR=.../v3/consumer python3 tests/scenarios/domain-traefik.py` | 18实际场景；标准Dockerfile分别构建API/Web/management/migrate，真实SQL/HTTP/CLI，不挂模板源码运行 |
| 共享来源/密码/权限安全专项 | `python3 tests/scenarios/domain-security.py` | 59ad固定点67/67及API/Web typecheck；真实独立PG/HTTP，生产认证代码从该点至29ce未改，非最终全量重跑 |
| 工具/环境/公开样板最终回归 | v3工具镜像 `node --test ...` + `npm run typecheck` | 29ce固定源211/211、0fail/cancel/skip及API/Web types exit0；完整命令/日志见v3/final-related.log |
| 升级F1最终完整实证 | `DOMAIN_RELEASE_SET=v3 python3 tests/scenarios/domain-upgrade.py` | 8场景通过，完整真实CLI/七检查/catalog/discovery/外部应用，详下 |
| 包保密/链接负例 | `python3 tests/scenarios/domain-package-boundaries.py` | 59ad包器4场景，真实.env/.env.prod/.env.local/secret及credentials目录伪值未进入tar/project，symlink失败且无complete；对应包器源码之后不变，当前公开路径负例另由15专项+真实CLI symlink覆盖 |

### 两套真实域名闭环的含义

- 原空白配置直接Compose up非零，API容器0；`compose run --no-deps api`仍由预载拒绝，业务marker无输出。
- env-check/env-list/start均单JSON exit0；准确APP_PUBLIC_URL返回HTTPS域名。服务实际user：environment `0:0`、状态`exited/0`；API/Web/entry均`node`正常运行，应用未读取宿主私有.env。
- 自有Traefik真实TLS握手及Host路由：登录页200、未知Host404；仅本次自有proxy约束的测试label，未操作原代理/网络/端口。
- 真实CLI随机私有凭据→正常密码POST；错误Origin403、Secure Cookie、零角色403、CLI授权后旧401、新登录保护访问200。
- 改变伪XFF/stamp的同一客户端6次失败为`401,401,401,401,429,429`，不能靠伪来源规避限制；多来源/可信peer细节另有固定67专项，不冒称本轮穷尽全部网络拓扑。
- maintenance-halt真实停业务后域名503、entry live200，resume后原合法会话200；B项目不同Host/品牌仍503自己的维护状态，A仍200，不串路由。
- 自有数据库/测试身份/密码文件只存在临时项目；非生产fixture认证、未操作真人或Feishu。

## F1独立发现与修复证据

原历史报告 [domain-environment-upgrade-boundary-review.md](domain-environment-upgrade-boundary-review.md) 及 `test-results/domain-boundary-review/` 原文不改。F1是公开example被baseline/catalog的秘密规则阻断，不能用“当前无from”永久解释未来路径。修复在`412d1c7`：

- generic `secret()`仍保守；另有精确公开模板路径策略，仅根、pristine baseline、release/project对应四个位置。不是放开任意.env.*或任意深度同名文件。
- baseline保留完整source/hash校验；root public example、compose.traefik.yaml纳入当前复制及模板管理集合，进入三方和完整patch；catalog/read/download复用精确允许路径。
- 原独立fixtures修前证明阻断，修后成功期望版本复用同一fixture/实际validator；15路径专项RED→GREEN，真实例子不靠替换安全谓词。原诊断脚本断言的是旧故障，保留不改，不把它原样当绿色。

最终v3真实场景 `upgrade-proof.json`：

1. domain.3→有明确from的同合同目标，**7/7检查**：lock/install/combination/semantic/API build/Web build/受信behavior；directlyApplicable=true，patchValidation passed，源项目全文件/模式只读不变。
2. 源公开example自定义项目名保留，目标heartbeat45合并，业务源码注释、业务config及业务version1.0.0保留；没有从真实.env生成样板。
3. 同值公共样板仍复制；公开example冲突或当前删除且目标修改均exit2人工项；public example符号链接exit1，无候选。
4. 真实无from控制（旧domain.1→domain.3）仍exit2 unsupported-path；不宣称所有旧版本均已逐一执行。
5. **工具外的一次性副本**先git apply --check再apply，按vendor清单准确替换/删除旧包；所有交付文件bytes+mode等于candidate。私有.env/.env.prod/.env.local三者保持原字节，均未进入candidate/patch/report；再实际API/Web构建、types、behavior成功。
6. 实际catalog builder接纳完整release/project/baseline公开example；实际discovery目录来源下载、合法路径及累计检查成功，不是手写catalog或只测过滤函数。

F1是否关闭交最终独立复核；本报告是开发实证，不冒称独立批准。

## 故障记录与平台限制

- 初次CLI状态测试无API网络，status用例超时；接入自有运行API后100相关通过，属中间镜像点，不冒称最终211。
- 初次安全夹具缺TEST_WEB_URL，67中65pass/2fail（含父项）；补真正自有Web后67全过，未改产品认证逻辑。
- 类型空值/项目标识/管理JSON/权限修订均有单独RED日志。最初模块缺失RED之外，也有实际行为失败→修复证据，不仅import成功。
- .1/.2是不同源点安全留档，不冒称含最终权限和JSON修订；v3/current/target是测试版本，不是生产正式发布或自动升级许可。
- Ubuntu/用户wildcardTLS/Feishu仍需真实环境与本人授权；未调用个人profile/Ego31/OS剪贴板、未外发通知。应用无新增测试登录入口或业务SQL/接口。

## 清理、复跑与交接

根/消费者驱动finally均down自有Compose/volume/local tags、删自有Traefik及external测试network、移除临时.env/账号文件/backup key/构建缓存。升级/外部apply/目录发现的临时副本与假secret全部删除，只保留安全candidate/vendor/proposal/日志。最终 `cleanup.json`、`verification.json` 对运行资源、绑定SHA、秘密模式、脚本语法和文档链接进行复核；共享BuildKit缓存不prune，既有GC负责，不冒称Docker磁盘无新增字节。原templux3+traefik/.env/presentation/schema0004/真人/飞书未操作。

复跑只用新的独占输出目录，不覆盖既有版本。release-v1/v2/v3脚本明确固定各自source/overlay，重复生成会拒绝已存在目录；真实Traefik驱动参数详上。用户执行从Ubuntu指南开始，先明确真实域名/网络和授权独立目录，不能将本机合成值部署到现用服务。

最终文档/场景提交SHA在交付消息给TL；产物不随源码提交自动对外发布，#31/#32/#30/父#1保持开放待审查/剩余验收。
