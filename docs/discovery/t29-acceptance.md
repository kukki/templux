# T29 首版候选交付演练与剩余验收项

## 结论与边界

本票形成可审查的本机完整候选和真实隔离安装、恢复、升级演练。**不宣称 #30 或父 #1 的全平台验收完成**：Linux 宿主、Windows/WSL2 尚无可用环境；真实飞书组织/本人授权仍未执行；本机默认 BuildKit 冷安装网络路径未通过。上述缺口已向 TL 报告，不能用 Linux 容器、密码或已有缓存替代。没有推送、外部 registry、关票、自动上线或全局计划任务。

实现/运行产品基线 `c02ac42859b7140a5e76f7b4126b18973bbdd84f`。前置独立来源核对 `df628c0f4296fc1d26a8c1db233b3853885a9fec`，Standards/Spec0，TL 随后仅放行本机候选生成，**不是产物验收批准**；原 [固定方案](t29-candidate-plan.md) SHA `0ded7d9cce3b3c5fa661864ee08b4df8d1b852211c22a53150dcaf5f1a5dbd5c` 未更改。[17组能力矩阵](t29-matrix.md) 将新实跑、固定来源历史证据及未执行分开。

本票没有改产品认证/授权/会话/SQL/控件或发布工具，也没有新增迁移、模拟登录入口。新增的是可复跑交付驱动、清单和报告；真实缺口为本机环境和尚未提供的平台，没有用产品改动掩盖。

## 完整交付候选，而非旧包冒充

安全产物根 `test-results/t29/`（忽略目录、本地文件授权）。交付总清单 **`delivery.json`**，具体 file SHA/mode/exports/SQL/编译来源为 `artifact-inventory.json`。

| 交付层 | 精确内容/来源 |
|---|---|
| 完整源码 | `source.tar`，固定 c02ac428 的完整 **682 文件**；Git archive `tar.umask=0022`，全部文件集合/字节/模式与隔离构建源相等，无 .git/.env/凭据/备份/test-results。SHA `2def5952d2b763b0369b0a47951eb81452fe0cff28bc8a294a410d9129ed6619`。 |
| 元数据 overlay | `release-overlay.json`，版本 `0.1.2-t29.1`、from `[0.1.0,0.1.1-t28.1]`；仅容器内挂载，宿主 release.config/旧发布不改；SHA `5102c4937abddfca992e49a8c0fc1db9ffafa290515062399022cd38b99aed75`。 |
| 两个真正 npm 包 | `releases/0.1.2-t29.1/`，统一准确版本/协议1/config1/schema0010/Node24/Next16；manifest、complete、project/vendor/lock/baseline 一起校验。 |
| 独立工具 | 同源标准 `updates-tools` image **`sha256:4a360eb0e21493ac244540ef57364e4fe516dccbdcae1509461c7a8308b9abd1`**；包含 release/upgrade/discovery，完整源码包可重建。不是 npm 运行包或业务进程 timer，不要求私有 registry。 |
| 项目所有 | 小型 API/Web 骨架、业务/config、独立业务版本1.0.0、运行.env/密钥/数据；pristine baseline 不吸收项目定制。 |

新包 manifest SHA **`de067a89e34f10a482286d7d8b330e9522ab7ad7bb1c7d751c9c9317d6f13878`**；core tar **`02e7b02a66eef73dee4a2c15238c6c2631e370a09d70cca8dfb432fdeee6895d`**；web tar **`b1f92427590644e6448ce2a4c5ecc19a0f806ec44db9b132b9be18465f978913`**。SHA512 亦在 manifest/npm lock，complete 最后生成且再次核对。

局部发布 source.files 是 **201 项，不是完整源码682项**。相对正式0.1完整并集：恰3受审复制产品+2受审发布工具修改、3已审T27骨架新增、0删除/额外项；API/SQL完整目录无新差异。独立 T26/T27 工具由源码/image另列，不能拿旧0.1或历史 .2/.3 overlay 冒充全部能力。正式0.1及T28测试发布 tar SHA保持，未覆盖任何旧版本。

`python3 tests/scenarios/t29-artifact-audit.py` 退出0：130 core/113 web常规文件的安全路径/类型、默认配置、6/47个显式 exports、全部10个SQL迁移及78项API编译文件与工具来源核对；独立工具+编译 inventory135项。`t29-final-audit.py` 又从实际生产消费 API/Web镜像读取安装包，全部130/113文件**集合/字节/模式等于原tar**。API literal inventory 有界标注不是穷尽路由；公开接口合同仍以 package.exports、shared-release/auth/session/management 规范及真实HTTP检查为准，不允许任意内部覆盖。

## 工具容器入口与独立构建

`tools-build-command.json`、`tools-build.log`：固定归档源构建标准 updates-tools，退出0。默认 entrypoint 是 `node tools/updates/cli.mjs`；切换产品入口必须显式覆盖，不能将 npm/release/propose 参数误交给 updates解析器：

```sh
# 使用delivery.json里的准确image ID，下文IMAGE为该ID，不用latest。
docker run --rm --entrypoint node "$IMAGE" tools/upgrade/cli.mjs ...
docker run --rm --entrypoint node "$IMAGE" tools/release/build.mjs /release
# release另需固定source commit、受审overlay和exclusive输出，完整命令见release-command.json。
```

实际 release、propose 两入口都已执行，非仅 --help。`toolkit-proof.json`：包内项目 `check-updates` launcher 的真实双tick间隔1067ms、manual立即检查、进程重启等待1053ms；项目独立Compose样板双tick1043ms。仅自有目录来源/catalog及短周期，默认每日与长周期/锁门禁由本票完整suite及固定T27修复证据覆盖，不声称实际等待一天/31天。未注册全局scheduler、未带DB/飞书秘密或发消息。source/image/file SHA绑定见总清单，不凭image tag认证来源。

## 新实际完整容器 suite

`python3 tests/scenarios/t29-suite.py build|run`：固定归档源、独立 `t29-suite`、tmpfs auth/restore PG18.6、真实 API/Next SSR；外部 Feishu仅测试进程模拟协议，生产 API无fixture。

最终 `suite-full.log`：**517/517，0fail/cancel/skip，106.53秒**；`suite-types.log`：API/Web均退出0。源码是固定 c02ac428，工具/checks image `4a360eb…`，suite API `b69aa7f…`、Web `9af412e…`，完整ID见 final-integrity.json。这是本票新实跑，不是将早期332或T28专项冒充最终全量。后续只改宿主场景/报告，不把它们称已包含在该镜像或517测试点。

完整suite覆盖17组中的核心SQL/HTTP/CLI与控件可控状态：组织拒绝/Pending、人员/Agent/PROD、关联竞态、最后管理员并发、会话/闲置、失败限制多实例、强审计/登录例外、CLI、备份/恢复真实故障/AM对象、搜索/多选/分页/编辑/通知/图片/复制/面板/导航、组合/最终快照与完整patch、累计路径/调度/来源故障。浏览器原生边界另列，不用这些状态测试冒充实际交互。

## 新锁定消费项目与真实数据库

路径指针 `consumer-path.txt`，项目 `t29-consumer`；自有 Delta业务/config，不挂模板checkout运行。**实际 macOS宿主wrapper→容器init**写名称/品牌/深褐，Web未运行；JSON stdout整体可解析。首启空库标准迁移0010，再启动APP，业务1.0.0/共享0.1.2-t29.1独立。

`consumer-proof.log/json` 复用版本化 T25公开边界驱动并加T29恢复/重启，最终退出0：

- 正式创建人员/0600凭据→密码POST；零角色保护403、user保护200/业务403、多角色user+reviewer业务200/他人scope403；每次授权旧401、普通管理API403。
- 正式独立Agent、真实责任人、默认无业务权限；明确reviewer后200、旧401；没有员工凭据复用。
- 真admin账号/审计API及SSR页面200、生产fixture404；示例不授管理权限。
- 容器PG工具实际manual备份，SHA一致/0600、实际明确independent目标恢复，3账号保留、会话0，源连接未切换。
- 持久维护提醒/取消、实际halt保留entry503、显式resume后原有效会话200。
- 人员/Agent正常重启后仍200；坏SHA原库恢复预检拒绝且当前仍200；原库真实恢复保持entry503，显式resume后全部旧401、新正式密码登录200。

`independent-deployment-proof.json`：再次选择明确independent目标真实恢复后，**显式**准备独立部署/网络/入口；恢复初始entry503，显式resume后旧人员/Agent均401、新登录均200；源库原cookie仍200。不是只检查SQL为空就宣称HTTP已拒绝，也没有自动修改源连接或自动开放目标。

`cli-menu-proof.json` 是真实macOS PTY→hostwrapper→实际容器菜单，选择2查看状态，exit0，无变更。完整参数init/backup/restore/maintenance及缺确认/无TTY/JSON诊断由真实公开链路及517覆盖；不把此PTY当Linux/WSL宿主。

## 本机冷构建环境限制（未隐瞒）

默认 BuildKit 网络下 npm ci超240秒无完成，已只取消自身构建客户端；`consumer-management-observed-build.log`、初次init日志保留。普通全新Node容器**同锁94包5秒/exit0**：`consumer-cold-install-diagnostic.log`。同一标准Dockerfile **--network=host** 独立api/web/migration/management均exit0；命令和日志 `consumer-image-commands.json`、`consumer-target-*.log`。

Compose当前bake未自动授network.host能力而明确拒绝，COMPOSE_BAKE=false亦未解决；未绕过审批/更改全局Docker设置。只将**自有项目Compose**切为预构建的准确images，wrapper的--build对image-only服务无构建任务，再真实跑init/start/maintenance/restore。`consumer-image-deployment.json`明确该workaround；候选默认Dockerfile/Compose没有修改。**默认冷安装路径仍未通过，需可用环境补验**，不能以缓存或host网络结果写成默认通过。

## 新实际浏览器、截图与配置重启

自有 Ego81，正常密码表单，实际包生产Web。`browser-proof.json`：普通人员protected200/admin403；blur/修改重查/显式保存；整段trim搜索、无匹配保留5表头；排序URL刷新；图片Escape/焦点恢复。390px页面宽390，表容器304/内容960，scrollLeft656，全部5列仍可访问；不是整页横滚。`dirty-revoke-browser.json`：真实dirty且confirm会拒绝的条件下，CLI仅撤该隔离人员角色，online检查立即到持续authorization_changed登录说明。

Ego截图Page.captureScreenshot超时，明确使用自有agent-browser命名session fallback；密码经stdin传给正常表单，未放argv/日志/持久vault，未操作OS剪贴板。新真实图已查看：

- `business-desktop-fallback.png`、`examples-desktop-fallback.png`：深褐纵向，真实业务返回/控件；不是模拟身份页面。
- `examples-narrow-scroll-fallback.png`、`drawer-narrow-fallback.png`：390px表内末列/文字抽屉及退出可达。
- `light-blue-horizontal-desktop.png`、`light-blue-horizontal-icons.png`、`light-blue-horizontal-drawer.png`：浅蓝横向、可收起图标与窄屏文字抽屉。

`config-variant-proof.json`：改已有公开config不重启仍#211913旧快照，**同一组image**重启后#f5f8fc、横向及默认5条实际DOM生效；未重建来冒充运行配置生效。项目独立业务/角色/包锁不变。T20四主题×横纵×桌面窄屏 **8组16图** `test-results/t20-matrix.json`/`t20-shots/`只作固定历史复用，深黑图标/深黄等不冒称本票重拍；导航模型/壳/导航CSS/default配置相关SHA对照见reuse-evidence.json。维护条等后续不相同区域由本票真实页面另验，不以旧图证明全Web同源。

`examples-removal-proof.json`：自有副本物理删除项目examples路由、生产Web实际构建，关闭examples配置，正式密码登录200，examples404，account/protected/admin/audit及管理/审计API均200，导航不留入口。共享包字节未改，不通过覆盖内部代码或业务fixture维持通过。

## 实际定制升级和失败报告

`python3 tests/scenarios/t29-upgrade-proof.py`：新Juniper正式0.1消费者，自有业务greeting/config/version；准确选择新0.1.2候选manifest，readonly源。

| 场景 | 本票实际结果 |
|---|---|
| 成功提案 | 真实7检查passed，manual0/direct true，报告/patch/vendor新输出，不改原project |
| 缺baseline | exit2/manual baseline/direct false |
| 竞争check-updates新增 | exit2/add-delete merge conflict/direct false，不静默覆盖项目入口；非伪造文本冲突 |
| 语义失败 | 实际typecheck exit23，整体exit2/direct false |
| 审阅后一次性采用 | 作者显式审阅（不冒独立审查）、git apply --check/apply+精确vendor；**85文件集合/字节/mode**=candidate/report.final；API/Web types/独立build/业务检查exit0 |

完整真实文本冲突、累计两边、晚检查篡改门禁仍由517及固定T26/T27实证覆盖。历史.2/.3只是已注明的独立累计演练，未纳入本票候选。复用范围由reuse-evidence.json逐路径限定：T26以后files/propose仅增加已审check-updates白名单，T27以后仅严格SemVer verifier有改；当前517和新launcher提案/冲突已实际覆盖这些变化。交付/检查/三方合并模块一致，既有逐步真实构建证据仅按该有界范围复用，不谎称本票重新打了中间版。T28通用贡献独立审查→批准→隔离发布→B完整采用为已固定报告及产物，本票不再自行“批准”或重做贡献流程。

## 失败记录、复跑与未执行

保留而不算通过：suite错误继承updates entrypoint；516/517因测试API别名遗漏；中途冗余尝试主动停止；初次archive默认0664与抽取0644模式不一致后统一tar.umask0022；冷网络挂起/host能力拒绝；PTY初版误假设退出项而超时，改实际2状态菜单；Ego未滚动到长页输入超时及截图超时；fallback首轮旧按钮selector/并发session干扰，改独立命名session；变体init首次缺必填name明确拒绝。T25复用记录的orientation硬编码horizontal与实际vertical不符，保留原日志并追加metadata correction，未来驱动按真实config读取，浏览器已实际确认vertical。无失败被静默计入最终通过。

主要可复跑顺序（仅自有新目录/空闲端口31329/31829/31330/31830/31331/31040）：

```sh
python3 tests/scenarios/t29-source.py
# 按tools-build-command.json构建标准updates-tools并精确记录ID
python3 tests/scenarios/t29-suite.py build
python3 tests/scenarios/t29-suite.py run
python3 tests/scenarios/t29-release.py       # 需真实固定方案放行；exclusive，不覆盖已有产物
python3 tests/scenarios/t29-artifact-audit.py
python3 tests/scenarios/t29-prepare-consumer.py
python3 tests/scenarios/t29-consumer-proof.py
python3 tests/scenarios/t29-independent-proof.py
python3 tests/scenarios/t29-upgrade-proof.py
python3 tests/scenarios/t29-toolkit-proof.py
# upgrade-build-command.json安装/两端构建；正常登录新TaskSpace再调用t29-browser.mjs
python3 tests/scenarios/t29-examples-removal.py
python3 tests/scenarios/t29-menu.py
# 新自有Ego空间执行dirty-revoke（脚本实例81是本次历史，复跑改为自己的新空间）
python3 tests/scenarios/t29-browser-fallback.py
python3 tests/scenarios/t29-config-variant.py
python3 tests/scenarios/t29-final-audit.py
```

本次每条实际命令、image/lock及退出结果在对应JSON/log。fresh脚本拒已存在输出，复跑应归档旧证据并新建自有根，不删除未知/他人产物。host只既有Shell/Python/Git/浏览器工具，npm/TS/PG全部容器，不安装宿主应用依赖。

剩余 **Linux宿主、WSL2、真实Feishu本人组织授权、默认BuildKit冷网络安装** 的具体条件/复跑见matrix与上述环境说明；必须补实际结果或由用户明确变更支持承诺，不能自行降低AC。非穷尽物理触屏/软键盘/辅助技术/云TLS/大库矩阵，既有受控触屏/模拟时钟证据按范围复用。图片不设像素门禁。

## 安全、清理与最终点

final-integrity.json记录全套source/compiled/package/image绑定、公开证据对本票随机密码扫描零命中、私有0700/0600。真实凭据/运行.env/PG归档和归属key只在自有受限目录，完成后移除；safe源码/vendor/发布/提案/日志/图片保留。清理仅本票Compose/网络/卷/浏览器/缓存，细节见cleanup.json；不删共享Docker全局cache/他人镜像。原schema0004/.env/实际presentation、真人、Ego31、飞书及原traefik均未操作。

精确最终产品运行点仍 c02ac428；新场景/文档的本地提交SHA由交付消息给出。517/types属于上述固定镜像点；后续驱动修正、模式核对、浏览器和清理各有实际证据，不将其混成第二次全量517。报告供TL独立最终审查，**不建议仅凭本报告关闭#30/父#1或T03**。

最终清理实证：cleanup.json 自有容器/数据库/卷/网络为0，仅原有templux三服务与traefik保留；7个自有项目安全源保留，凭据/.env/PG归档与key/构建缓存已删除，自有Ego81及两个fallback session关闭。清理后artifact-audit/reuse-evidence再次exit0；所有T29 Python AST、Node场景语法和git diff --check通过。`t29-closeout.py --require-clean`在提交后绑定报告commit、复制可携带docs与DELIVERY.md、复核无自有运行资源；delivery清单的最终SHA见closeout.json。
