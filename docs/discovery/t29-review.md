# T29 独立审查：本地完整候选与剩余验收

## 结论

**Standards：0项新增发现。Spec实现层：本轮未发现可定位的新增产品缺陷；完整验收尚未满足。** 本地候选的来源、包/工具/项目交付和本报告所列真实链路已独立验证，**不建议关闭#30、父#1或T03**。

必须保留四项未通过：**Linux宿主、Windows/WSL2、真人飞书组织授权、默认BuildKit冷网络安装**。前两者没有可用宿主，不能由Docker Linux容器代替；真人未授权，不能由密码/模拟OAuth代替；host网络或prepared images成功不能替代默认冷安装。需要补实证或由用户明确调整支持承诺，不自行降低AC。

同一独立审查者依次执行Standards/Spec，遵循Team权限不新增成员。固定交付报告点 **`83bf8f3091d7b803df797bb56f26011cba2caaba`**；运行/完整归档点 **`c02ac42859b7140a5e76f7b4126b18973bbdd84f`**，前置方案独立报告 `df628c0f4296fc1d26a8c1db233b3853885a9fec`。核对#30/#1完整17组矩阵、验收/测试规范、候选方案审查、t29-acceptance/matrix、可携带DELIVERY及新增驱动差异。本阶段产品/工具/SQL源码相对运行点无变化，未将新增驱动说成已进入运行归档。

## Standards及审查方法

没有发现独立的规范违背。交付分清运行包、完整源码、独立工具、项目配置/业务及报告证据，版本/hash锁定、失败和未执行标注准确，无自动上线或跨项目写权限。新驱动以自有项目/库/端口/受限凭据执行，清理只作用本任务资源；portable文档明确默认入口及显式覆盖、受控来源和人工应用边界。

codebase-memory按search→trace→snippet核对restore/propose/discovery依赖；28个依赖代码/驱动路径coverage为metadata_match、best_effort无记录缺口，直接补读源码/脚本。restore snippet输出截断部分129–150行已直接读取。SQL操作前应用Postgres技能；Context7 PostgreSQL18官方资料核对单事务restore/psql及ALLOW_CONNECTIONS/terminate语义。已有T22–T28逐项并发/wire/控件审查按精确未改源码复用，不重复扩展所有旧故障矩阵。

## 固定交付及来源

| 项目 | 独立核验的精确身份 |
| --- | --- |
| delivery.json | `3928db76aee723b9b16d839b3d1579c38b797d2dc8b56316ca7bf1e2ad63f237` |
| 完整source.tar | `2def5952d2b763b0369b0a47951eb81452fe0cff28bc8a294a410d9129ed6619`，682文件，固定c02ac428 |
| 元数据overlay | `5102c4937abddfca992e49a8c0fc1db9ffafa290515062399022cd38b99aed75`，仅version/from |
| 候选版本/路径 | 本机隔离`0.1.2-t29.1`；from仅`0.1.0`及`0.1.1-t28.1` |
| manifest | `de067a89e34f10a482286d7d8b330e9522ab7ad7bb1c7d751c9c9317d6f13878` |
| core tar | `02e7b02a66eef73dee4a2c15238c6c2631e370a09d70cca8dfb432fdeee6895d` |
| web tar | `b1f92427590644e6448ce2a4c5ecc19a0f806ec44db9b132b9be18465f978913` |
| 独立标准工具image | `sha256:4a360eb0e21493ac244540ef57364e4fe516dccbdcae1509461c7a8308b9abd1` |

独立复跑artifact-audit审查副本（只改输出根），核682完整集合/字节/mode等于固定Git归档/构建源，归档无运行.env、凭据、缓存或test-results；201项局部source.files与前置完整并集一致：3copy产品+2发布工具修改、3T27骨架新增，0删除/额外项。没有把201冒充全交付；API/SQL无额外漂移，不混历史.2/.3接口/资产。

实际tar安全路径/文件类型/默认配置/6个core与47个Web exports、10个SQL迁移及78项API编译文件均与来源对应；工具与编译库存135项单独核对。complete、manifest、准确依赖/SHA512、lock/vendor/pristine baseline在实际安装/提案中再次校验。正式0.1、T28包及固定历史发布未重生成或覆盖。可携带324个docs文件按delivery逐SHA核对；复跑T29新驱动需要报告点checkout，如DELIVERY所述，不假称它们存在于较早c02ac428源码归档。

独立运行的自建API/Web消费镜像内，安装的**130 core/113 Web完整文件集合/字节/mode等于候选tar**，见`installed-bytes.json`。这使后续真实HTTP/浏览器属于最终候选包消费，不只是旧模板镜像测试。自建镜像ID与开发ID不同有明确记录，不以tag冒充相同image。独立工具默认updates入口，release/propose需显式entrypoint；release生产命令和现有产物核对，本轮未重生成版本；propose、catalog/discovery、launcher、schedule和Compose在本轮实际执行。

## 独立执行结果

所有新证据根 **`test-results/t29-review/`**（0700），不覆开发`test-results/t29/`。自有脚本由版本化驱动生成审查副本，仅调整输出根/项目前缀/端口/自有路径；候选tar/产品源不改。

### 完整517与类型

- 自有Compose项目 `t29-review-suite`，独立tmpfs PG18.6/auth/restore与真实HTTP/Next SSR，显式TEST_API_URL/TEST_WEB_URL，未回退原部署。
- 工具/checks使用准确4a360eb镜像；API/Web仅给既有固定同源镜像加自有别名，原ID分别b69aa7f3…、9af412e6…，未冒充新构建。
- `suite-full.log`：**517 tests、517 pass、0 fail/cancel/skip，110101ms，退出0**；随后`suite-types.log` API/Web tsc均退出0。
- 完整命令见`suite-run-commands.json`：固定归档compose + 自有override，`docker compose ... run --rm --no-deps checks npm test`及`npm run typecheck`，driver `python3 test-results/t29-review/suite.py run`。未将开发106.53秒当本轮耗时。

### 新消费、权限、备份与恢复

自有`templux-t29-review-consumer-*`，端口31429/31929，真实macOS宿主wrapper→管理容器init/完整JSON，空库标准迁移0010后start。独立api/web/migration/management按标准Dockerfile用host build network准备images，仅在**自有项目Compose**使用prepared images，明确不是默认冷安装通过。

`consumer-proof.log/json`均通过：人员正式随机0600凭据/密码POST；零角色403，user protected200/业务403，user+reviewer并集200、他人scope403，普通admin403；角色改变旧401。独立Agent有真实责任人，初始403、授权后业务200/旧401。真实admin accounts/audit及页面200，生产fixture404。业务/config/品牌及独立业务版本1.0.0保持。

真实PG工具备份SHA匹配且宿主文件0600；明确independent目标恢复后3账号/会话0，源会话仍200；持久维护提醒/取消、halt entry503/resume原会话200；正常api/web重启后人员/Agent均200。坏SHA原库恢复拒绝且源仍200。**真实original恢复保持entry503，显式resume后全部旧人员/Agent401、新密码登录200**。

另独立运行`independent-proof.py`：恢复到明确不同目标后，显式创建独立部署/网络/入口，初始503；resume后目标旧人员/Agent401、新登录200，源库旧会话仍200。没有自动切源连接或只看SQL为空就宣称HTTP拒绝。测试库/卷/归档均自有，原数据库未查询或变更。

### 定制升级与独立工具

Juniper新项目→准确候选，7项lock/install/combination/semantic/API/Web/behavior全passed；缺baseline exit2/direct false、新增check-updates竞争冲突exit2/direct false、semantic实际exit23且整体exit2/direct false。每个输入readonly前后库存相等。

本审查者在自有副本实际git apply --check/apply及精确vendor替换，**85文件完整集合/SHA/mode=candidate=report.final**，重算tree SHA **`16026062e561ed957d30c697a57ec8ed57744dc4d50becd3fa4704e1dc093821`**。项目品牌/config/业务/version保持，目标baseline pristine。应用副本实际npm ci/installed/typecheck/API/Next production build/behavior均退出0，`upgrade-build.log`。驱动中的作者采用记录标识不被拿来代替本独立审查。

真实发布项目launcher、catalog、manual、进程重启及独立Compose有限双tick退出0：本轮launcher间隔1167ms、重启1215ms、Compose1047ms，manual no_update；见`toolkit-proof.json`。未注册全局任务、未外发、未等24小时或31天；长周期/原子期限由517和固定T27复核实证覆盖。

### 浏览器、移除与图片

Ego自有空间82，正常密码表单登录实际消费页面。`browser.json`：person protected200/admin403，blur/修改重查/显式保存、整段trim搜索/空结果5表头、排序URL刷新、图片Escape/焦点恢复。390px页面宽390，表容器304/内容960、scrollLeft656、全部5列，非整页溢出。

真实dirty且confirm会拒绝时，CLI授权变更/online核验仍立即跳登录并持续`authorization_changed`，`dirty-revoke-browser.json`。物理删除项目examples路由后独立标准Web构建成功：真实密码登录200、examples404、protected/account/admin/audit及管理审计API均200、导航隐藏；见`examples-removal-proof.json`。此构建本轮host网络亦成功，仍不能替代默认冷网络。

独立查看本票7张真实PNG（业务/桌面示例/窄屏表滚动/深褐抽屉/浅蓝横向桌面/抽屉/图标）；与DOM及配置证据一致，无像素门禁。旧T20四主题16图为固定来源复用，不冒充本票新图。`reuse-evidence.json`独立再算hash：导航/贡献源一致；T26白名单与T28严格verifier变化逐项列出，由当前517/新提案补覆盖。未盲目重拍全部图或重跑无改物理触屏/原生Clipboard矩阵；没有触个人剪贴板。

## 17组矩阵核对

下表“本轮”指独立执行；历史仅按固定源码界定，不意味着对应所有OS原生行为重跑。

| 父验收组 | 本轮与可追溯范围 |
| --- | --- |
| 独立启动及配置 | 517、macOS真实init/start/0010、安装字节及两端构建；配置重启变体另核开发JSON/7图与固定T02证据；默认冷安装未过 |
| 首次授权 | 517真实SQL+模拟外部协议；真人组织授权未执行 |
| 账号及Agent | 517+新项目正式密码/责任人/零角色/角色链；PROD和关联细节在当前suite与既有切片 |
| 管理不变量 | 517并发/强审计，加新admin/普通拒绝 |
| 会话 | 517、重启200、撤权401、original/independent恢复旧401新200 |
| 闲置及心跳 | 517及真实dirty撤权优先；浏览器后台精确定时不保证 |
| 登录限制 | 517 SQL多实例/并发/时限；来源代理固定代码与T07历史范围 |
| 审计故障 | 517强审计/登录例外及真实admin audit；未额外穷尽旧wire矩阵 |
| CLI | 517+macOS实际wrapper参数/JSON/init/恢复；开发macOS PTY菜单核证，Linux/WSL2缺口保留 |
| 备份恢复 | 517+本轮真实0600备份/original/未来independent接入及源保持 |
| 搜索多选 | 517+实际搜索；IME/三热区/触屏细节固定T11/12证据复用 |
| 分页排序及空结果 | 517+URL刷新/空5表头/390px横滚；完整排序边界T13固定证据 |
| 表单弹窗及内联行 | 517+真实blur/保存/dirty强退；T14/15已审异步边界按源复用 |
| 通知与维护 | 517+实际提醒/halt/resume/恢复offline；T16/21受控计时/锁旧证据限定范围 |
| 图片复制及面板 | 517+图片Escape焦点；T17–19/T28受控组件按固定来源复用，不宣称本轮原生OS权限 |
| 响应式及示例 | 517、实际390px表内滚动及物理删除后管理仍正常；7新图核看+16旧图hash复用 |
| 发布及升级 | 682/201来源与包/工具/安装全库存、85文件外部应用、四提案结果、真实launcher/scheduler；T27累计构建/T28贡献为固定历史复用 |

## 冷网络诊断与未完成AC

四类原始证据已核：默认BuildKit npm ci超过240秒无完成后仅自有客户端取消；全新Node容器同锁94包5秒成功；标准Dockerfile显式host网络四目标成功；Compose bake自动network.host能力请求遭拒（COMPOSE_BAKE=false也未解决）。没有把CANCELED/权限拒绝日志计成功。根因层面，这些证据说明网络/构建执行环境路径不同，**不足以定位新的产品代码缺陷或保证默认路径正常**。

本轮同样只验证host网络准备images后自有Compose的真实业务链路，不为制造“通过”改候选Dockerfile/Compose、全局Docker设置或越过环境批准。须在可用环境补一次真正默认冷安装（无已有缓存/预制image替代），记录命令、退出、来源、版本与清理。

Linux宿主和WSL2分别补实际Shell/路径/UID/GID/PTY/完整参数/JSON、安装恢复升级；真人Feishu必须本人授权并记录真实tenant/Pending/授权后重登等，禁止用Ego31或模拟替代。**这些是验收缺口，不以虚构F编号强定代码缺陷；#30/父#1完整验收继续未达成。**

## 安全与清理

自有证据根0700；生成3组随机账号凭据为0600，仅供自身库。对629个公开证据文件按本轮真实随机密码扫描0命中，private不作为公开证据；未打印密码/cookie。随后删除private、.env、credentials、PG归档/归属key及构建缓存。

自有6临时项目目录已整目录删除；suite/consumer/restored/removed/scheduler容器、数据库卷、网络全清，移除自有image别名，不prune共享cache。Ego82 finish完成。`cleanup.json`证明剩余仅原templux web/api/database及traefik；未停止、重启、迁移原部署，未读取其.env或个人身份。安全日志/候选/提案留存，原交付delivery SHA保持不变。

Python场景syntax、git diff --check通过；仅本独占报告本地提交，不改产品、交付清单/包、批准记录或开发证据，无push/关票/外发/部署。

**最终建议：记录“本地候选已验证的上述范围”，继续保留四项剩余验收；不建议关闭#30、父#1或T03。**
