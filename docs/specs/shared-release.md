# 版本化共享发布与项目所有权（T25）

Gitea #26 / 父#1故事5、7、8、15；ADR0011/0012/0029。首个受支持组合是统一`0.1.0`的`@templux/core`与`@templux/web`，Node24、Next16、协议1、呈现schema1、数据库0010。业务版本独立，本票样例为1.0.0，不跟随共享包或latest。

## 分发与信任

在受控模板checkout构建工具镜像，在容器内执行；宿主不安装npm或PG客户端：

```sh
docker build --target release-tools -t templux-release-tools .
mkdir -p releases
docker run --rm -e TEMPLUX_SOURCE_COMMIT="$(git rev-parse HEAD)" \
  -v "$PWD/releases:/release" templux-release-tools
# 维护者核对来源、验收与complete.json后，通过宿主文件授权提供整件0.1.0目录。
cp -R releases/0.1.0/project /approved/new-project
```

不调用npm publish、云API或外部仓库，不新增registry服务。releases默认排除Git/构建上下文；目录由宿主操作者控制，本地文件授权不等于公网可获取。包是只读可分发的非秘密0644文件，不能放凭据。清单包含每包准确名称/版本/文件名、SHA256、npm SHA512完整性、组合和发布输入哈希；complete.json最后写入。版本目录exclusive创建，拒静默覆盖；失败目录无complete，不作为成功发布，也不自动删除未知产物。发布前运行类型与接口/校验专项；首个组合另有真实隔离项目验收。主版本不兼容或其它组合没有隐式支持承诺。

项目vendor保存两个原始tarball与manifest；templux.lock.json另外固定清单SHA及同一包集合。验证器先核对受支持组合、准确版本、完整文件SHA/SHA512、实际归档package.json，再核对项目file:依赖声明；安装后核对npm锁和实际包身份。拒范围/latest、缺锁、不同版本、同版本不同字节、未知组合、归档路径穿越/绝对路径/链接/异常类型；验证前不提取或执行包脚本。安装`--ignore-scripts`，公共三方依赖由package-lock锁定，私有共享依赖只从vendor文件获取。构建第一步失败即不安装/编译。

这些哈希验证从受信锁到字节的一致性，不能认证攻击者同时替换的锁/验证器/清单；发布目录与锁的来源需要维护者核对和审查。package exports约束支持的导入，不是隔离恶意项目代码、管理员或数据库属主的安全沙箱。运行镜像来自同一受检组合；独立部署时维护者也须核对双方使用的manifest摘要，不提供跨版本实时握手或自动切换。

## 核心包与禁止覆盖

core包含现有认证/组织限制/Pending/密码/Agent/角色/授权/强审计/持久会话、运维CLI、维护入口、备份恢复、全部不可变SQL历史、shared状态实现及默认配置；不是只打一个helper。仅公开：

| 导入 | 合同 |
| --- | --- |
| `@templux/core` | `createProjectApplication`、`databasePool`、`changeProjectAccess`及业务Context/Route类型 |
| `@templux/core/presentation` | 既有校验/快照/格式化及类型；配置由项目提供 |
| `/manage`、`/migrate`、`/entry-server`、`/auth-config-probe` | 显式工具进程入口，非Web授权能力；只能在获授权工具/部署容器调用 |

`createProjectApplication(pool,{routes})`返回listen/close，不提供任意Fastify钩子、模拟身份、token换票或auth transport替换。每条业务路由仅GET/POST、`/api/business/`下静态路径、显式已在项目角色文件注册的permission和handler；重复/保留路径、未知权限拒绝。核心先持授权共享锁，再读取最新持久会话/状态/版本与多角色并集，要求application:read及该permission；Pending/disabled/零角色不放行。POST还校验Origin、取得业务写共享屏障并复核维护状态。scope与handler在同一事务内执行，锁等待后校验，异常回滚，COMMIT确认前不返回成功；提交未知沿既有事务错误合同核验、不自动重试。

项目scope(context)决定自己的数据边界，handler消费只读account、未知类型body/query及同事务PG client，须自行校验业务输入/最后服务端数据权限。没有通用仓库/供应商/业务范围模型。长网络操作不应占着事务锁。禁止通过内部模块、文件覆盖、SQL或钩子绕过认证、最后管理员、审计、会话版本、维护屏障或修改已应用历史；实际数据库权限仍需项目部署方管理，不声称可防恶意同权限服务代码。

`changeProjectAccess(pool,accountId,{source,actor},change)`供**已校验管理权限**的项目服务：授权独占锁→项目变更→账号版本递增和强审计→提交，同一事务失败一起回滚。source须如实来自cli/password/feishu；actor自报不冒充已验证身份。该函数不提供HTTP未认证入口。角色文件通过TEMPLUX_ROLE_CONFIG_PATH/项目config注册，保留admin/user及必要管理员权限、互斥和并集合规；修改角色定义影响既有账号时，项目须在受控停写部署中使受影响会话版本失效，不能用配置重启代替授权变更审计。

## 网页包：SSR、客户端与资产

Web包发布现有页面/SSR壳、全部T11–T20控件与状态模块、样式/合成资产、维护提醒、导航、登录和账号审计页面；保留`use client`边界，没有混合server/client总barrel。Next项目显式配置`transpilePackages:['@templux/web']`，各路由是项目自己的转接文件：

- `/layout`导出根布局与metadata；`/pages/home|login|account|protected|admin|audit|examples`为现有页面；`/proxy`提供同源API GET/POST转发。
- `/server/shell|profile|guard|unavailable`按既有合同组合业务页；profile403、401明确原因及网络/响应体故障语义保持。
- `/elements/名称`发布现有元素模块及TS类型，例如readonly-table、copy-button、edit-session；`/state/名称`为对应不含PG/凭据的状态模块。模块自己的server/client适用性和props合同仍有效，不把SSR配置加载器导入客户端。
- `/presentation`为服务端呈现能力；`/server`的startProjectWeb(已构建Next目录)复用现有来源IP/代理合同，不固定在包内寻找.next。

项目根布局/页面/业务源文件/文案/品牌、角色配置、数据库连接、非模板SQL、Docker/Compose与独立业务版本归项目。默认配置可复制再按既有校验修改，认证文案从项目配置目录加载；已有配置变化重启生效。模板内部JSON/样式/类实现不是任意文件覆盖扩展点。项目可选择自己的页面/壳并消费明确组件；无权仅靠隐藏导航获得后端权限。examples仍独立可选，不进入核心业务数据。

## 骨架、运维与基线

发布目录project是小型可复制骨架：只含自身API入口/示例业务路由、Next转接与业务页、配置、构建与部署、锁和vendor；没有模板API实现源码、整仓库或生产认证fixture。API/Web分别构建，不运行另一端编译；生产API无Next，生产Web无Fastify/pg。PG18工具只在管理/迁移镜像，Web不迁移。核心包内相对资源路径保持有效，工作目录/配置/备份/维护卷属于新项目，不反向挂模板checkout。

项目运行设置放自身受限.env（不要放进分发/baseline）。自定HTTP端口须同时设置APP_PUBLIC_URL；嵌套Compose读取同一项目文件，不能假设未投影到management的shell-only运行变量仍会保留。宿主备份bind与工具容器路径通过T24投影分开；CLI由宿主授权、凭据仍0600指定文件、Agent默认PROD拒绝，认证可用性由独立probe给管理容器，管理容器不直接接收飞书secret。start/维护/backup/restore继续遵守各自确认、锁/强审计、offline和恢复旧会话失效合同。

`.templux/baseline/project`保存原始骨架及默认非秘密配置；baseline.json保存原文件哈希、发布来源commit/选定输入tree哈希、manifest摘要；vendor保留不可变包。source.files是明确列出的发布输入集，不是整个Git仓库树ID；不包含生成cache。项目修改自己的业务/配置不会被verify回写，基线不吸收后续真实配置值。发布排除.env、秘密/凭据/备份/日志目录、fixture凭据、test-results、node_modules、.git、构建cache与map；实际tar清单另行验收。后续升级依赖原基线，缺失/篡改应在后票阻断，不在本票自动合并、生成升级或覆盖定制。

本票证据及平台边界见[T25验收](../discovery/t25-acceptance.md)。真实飞书组织人工验收仍单独pending，不能用此密码消费演练替代。

## T26 升级提案接续

0.1.0发布文件不变。后续发布版本可为准确SemVer，仍须满足上述受检协议/运行组合和字节锁，版本字符串不单独授予兼容性。目标manifest的`upgrade.from`须明确来源版本；缺路径不自动推断。基于保存baseline的三方候选、项目业务/config保留、隔离检查与人工审查应用见[升级提案](upgrade-proposals.md)。发布构建在complete之前再次校验整个项目锁/包组合，不发布不兼容完成标记。

## T27 发现与累计路径接续

项目自管的每日发现、精确目标选择、独立工具调度和逐边累计提案见[受控更新发现](update-discovery.md)。T26最终快照与完整补丁等价门禁保持；不自动应用、推进现用baseline或部署。
