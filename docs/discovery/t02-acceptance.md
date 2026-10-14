# T02 实现与验收记录

日期：2026-10-15（Asia/Hong_Kong）。审查基线：`72c69f8`；保留 T01 的 `bcc892e`、`72c69f8`。本记录适用于 Gitea `Swython/Templux#3`，不代表完整首版完成，工单待独立审查后由 TL 处理。

## 实现

- `config/presentation.json` 为项目公开配置，版本1严格字段/类型校验；环境与密钥保持 `.env` 隔离。前后端与初始化共用 `shared/presentation.mjs` 校验及格式化合同。
- 配置目录在运行服务只读挂载，在管理容器可写；服务保留进程快照，已有字段重启后生效。Next.js 页面、metadata 通过请求期载入，构建不固化部署品牌。
- 品牌、可选本项目 Logo、页头页脚隐藏/文字替换、版权与应用版本、集中默认简中文案、Asia/Hong_Kong 默认到秒、可变语言/时区/秒精度、四套配色统一变量已接入公开状态页。
- `init` 支持菜单7及完整参数；已有文件需显式覆盖确认，未指定字段保留，完整导入则以导入配置为基底。写入前校验、同目录原子替换、新建排他写入；保留已有文件属主/权限，新文件归包装传入的宿主 UID/GID。
- `config-check` 支持独立校验，`start` 在部署前校验，API 无效配置拒绝启动。使用合同见 `docs/specs/project-presentation.md`。
- 当前导航、分页、通知合同保存项目默认值，其实际控件归后续任务；本票没有新增认证、业务数据、个人设置、目录生成脚手架。

## 已执行命令与结果

| 验证 | 命令/入口 | 结果 |
| --- | --- | --- |
| 真实启动与迁移 | `./templux start --non-interactive --json` | 返回 ok；原安装迁移 applied=0，前后端及数据库健康。独立副本空库迁移 applied=1。 |
| 完整容器测试 | `./templux test --non-interactive --json` | 14/14 通过，退出0；真实 API、页面及容器内 CLI，无宿主 Node/npm 依赖。 |
| 类型检查 | `./templux typecheck --non-interactive --json` | API/Web 均通过，退出0。 |
| 复制/重启/无效启动 | `./tests/presentation-installation.sh` | 最终退出0；独立复制初始化启动、源码副本新增 Logo 资产构建/HTTP200、名称品牌版权、仅重启更新、无热更新、隐藏区域、无效 JSON 的真实 API/管理启动失败均通过。自有容器/卷已清理。 |
| 人工入口 | `docker compose run --rm --no-deps -e TEMPLUX_CONFIG_PATH=/tmp/t02-menu-presentation.json management`（PTY） | 无参数菜单选择7，输入名称“菜单验收项目”、品牌“菜单品牌”、dark-yellow，展示目标后输入 yes；实际完成 init，退出0。写入仅在一次性容器临时目录。 |
| Shell及补丁 | `sh -n templux tests/presentation-installation.sh`、`git diff --check` | 通过。 |

先在旧真实容器观察到 init 缺失功能导致3项测试失败，再实现通过。额外回归曾复现未指定品牌被覆盖、原权限被改成0644、umask导致0660变0640；修复后最终14项全部通过。无效导入不写原文件，拒绝无确认/无覆盖参数，错误不回显配置值，时区/语言/颜色/元素默认值校验及固定时刻格式均有容器测试。

最终隔离重启前后镜像ID相同，脚本直接比较而非推测无重建：

- API：`492ab04dd88adedba168265b986620d19b1cca25b5a61620086ee9b6a833603d`
- Web：`6e3c8d6993676e0b3a69bc84ea11218adb20bdfd8cb16a1121308e6907dd05e0`

配置更新前，API仍返回“复制验收项目”，页面仍显示“新项目品牌”；执行 restart api web 后，API返回“重启后新名称”，页面出现“替换品牌”“项目专属页头”“项目专属页脚”“重启即生效的项目文案”，lang=en-GB，UTC分钟精度。再次重启后 header/footer 均不渲染，主内容仍存在。完整 ISO dateTime 保留秒与毫秒；格式测试验证同一 `2024-01-01T00:00:01.234Z` 在香港显示08:00:01，UTC可改为00:00。

## 浏览器验收

Ego-browser 已成功读取真实 DOM与计算样式，但两种截图调用出现 `Page.captureScreenshot` 超时；改用独立命名的 `agent-browser --session templux-t02-brand` 完成 Chromium 验收，两个工具的自有浏览器空间均已关闭。

1440×1000 与390×844分别检查浅蓝、深黑、深褐、深黄，同一CSS变量机制生成的背景分别为 rgb(245,248,252)、rgb(16,20,24)、rgb(33,25,19)、rgb(32,29,16)。所有窄屏无页面横向溢出；项目品牌、页头说明、页脚及版权已在深褐副本中检查。隐藏区域副本在浏览器确认 header/footer 不存在，替换标题存在，仍无横向溢出。

另在390×500实际滚动：scrollY=316，headerTop=-316，footerTop=441.359375，header/footer计算position均为static，无横向溢出，证实区域随内容滚动。

截图（本机 `test-results/` 为忽略的验收产物）：

- `test-results/t02-light-blue-desktop.png`、`test-results/t02-light-blue-narrow.png`
- `test-results/t02-dark-black-desktop.png`、`test-results/t02-dark-black-narrow.png`
- `test-results/t02-dark-brown-desktop.png`、`test-results/t02-dark-brown-narrow.png`
- `test-results/t02-dark-yellow-desktop.png`、`test-results/t02-dark-yellow-narrow.png`
- `test-results/t02-hidden-regions-narrow.png`、`test-results/t02-scroll-narrow.png`

TL补充要求后，另执行 `TEMPLUX_HTTP_PORT=31020 TEMPLUX_API_PORT=31820 ./tests/presentation-installation.sh`，完整流程退出0，实际页面URL为 `http://localhost:31020`，自有资源清理完成。该次重启前后API镜像为 `6d590f5b1f299b2c7eaaa213dcaf90b90ec940efc34028b2367c177a0bbc65fa`，Web镜像为 `e8d83ff80c998d50a41271413f23bc5354418e0d01d668acc30e74f49c608155`；记录在 `test-results/t02-installation-alternate-ports.out` / `.log`。不同隔离构建的Web构建ID可不同；每次断言比较的是本次配置重启前后的同一个镜像。

完整命令日志：`test-results/t02-start.json` / `.log`、`t02-test.json` / `.log`、`t02-typecheck.json` / `.log`、`t02-installation.out` / `.log`。配色截图环境的自有容器及卷已清理，原默认安装保持健康。

## 范围与局限

- 本次环境是 macOS + Docker Desktop + Chromium；Linux宿主文件属主/组/权限合同在Linux容器中验证，未执行完整Linux/WSL2宿主矩阵或实体移动设备验收。
- 之前的最终脚本重跑曾因截图环境占用31010失败；已清理该环境并最终退出0。脚本默认需要31010/31810空闲，支持现有 `TEMPLUX_HTTP_PORT` / `TEMPLUX_API_PORT` 环境入口覆盖，失败与清理有明确结果。此环境冲突不是产品通过证据。
- 截图供人工审查，没有像素差门禁；没有使用生产或来源项目数据。自定义配色对比度由项目维护者负责。
- Impeccable机械检查报告一项既有的圆角面板上边框装饰警告；T02沿用基线状态页布局并将原色值变量化，没有在此票扩大为整体视觉重设计。
- codebase-memory 初始及最终已索引，使用图定位管理入口/状态页并追踪管理调用。相关实现及测试文件覆盖检查无已记录问题；TS配置曾标记not_tracked并直接读取。覆盖为best-effort信号，不宣称图证明全仓库完整。
- Next.js请求期载入通过Context7官方 `/vercel/next.js` 的 connection、self-hosting 文档核对。
- 已确认覆盖的并发更新采用最后成功写入，没有三方合并；运维需串行初始化。固定/吸附页头变体和实际导航/元素交互不属于T02实现范围。

## 2026-10-15 初审 S1/F1 修复验收

修复基线 `d4cccf4202fdc697f56ea0be06458c3cd60f0cad`。独立初审全文纳入 `docs/discovery/t02-review.md`，保留审查者原结论；本节记录开发复现与修复，独立复核待 TL 安排。

先通过 Receiving Code Review 与 Diagnosing Bugs 核验反馈：

- S1 在真实PTY执行原管理入口 `docker compose run --rm --no-deps -e TEMPLUX_CONFIG_PATH=/tmp/t02-s1-reproduce.json management init --name ReviewComplete --confirm`，停在可选品牌提示；Ctrl-C结束一次性容器。
- 将条件固化为回归，在旧checks镜像挂载当前测试执行 `docker compose run --rm --no-deps -v "$PWD/tests:/opt/templux/tests:ro" checks node --test --test-name-pattern='real TTY|umask 077' tests/presentation.test.mjs`：两项均失败，退出1。真实PTY保持stdin打开且不发送答案，3秒超时；F1初始化成功后，uid1000/gid1000调用实际 `loadPresentation()` 读取失败。复现日志 `test-results/t02-review-regression-red.log`。

定位后的最小代码修复：

- S1：管理入口只在无参数菜单或显式 `--interactive` 时开启初始化字段补齐；显式完整命令在TTY也直接应用可选默认/保留语义。既有确认、覆盖与TTY前提校验继续生效。
- F1：暂存文件在发布前显式chmod，新文件0644，已有文件沿用原模式；再保留/设置属主组。元数据失败仍由原catch/finally处理，文件发布前失败会清理暂存文件。

修复后的实际验证：

| 命令或回归 | 结果 |
| --- | --- |
| `docker compose build management checks` | 只构建管理/检查所需后端目标；成功，未构建Web或重跑隔离安装。最终checks测试更新另用 `docker compose build checks`。 |
| `docker compose run --rm --no-deps checks npm test` | 最终18/18通过，0失败、0跳过，退出0。 |
| `docker compose run --rm --no-deps checks npm run typecheck` | API/Web均通过，退出0。 |
| 原命令真实PTY再验 | `docker compose run --rm --no-deps -e TEMPLUX_CONFIG_PATH=/tmp/t02-s1-fixed.json management init --name ReviewComplete --confirm`，无需输入，输出“完成：init”，退出0。 |

新增/强化回归覆盖：

- util-linux `script` 分配真实PTY，保持输入打开；新文件完整命令无可选输入直接成功，已有文件缺overwrite立即失败且原内容相同，显式overwrite成功且保留未指定品牌。
- 菜单7与显式interactive均由真实PTY按提示输入，实际保存名称、品牌、配色并确认。
- `umask 077`、HOST_UID/GID1001创建的新文件，`setpriv`以服务uid/gid1000实际读取成功；断言模式0644、属主/组1001，目录仅有最终配置文件。
- 已有文件0660在umask077覆盖后仍为0660，属主组保留。
- 用无效宿主UID触发暂存文件创建后的元数据失败，退出1且目录无最终文件或暂存残留；既有无效导入/覆盖保护和真实默认API/Web测试继续通过。

最终日志：`test-results/t02-review-build.log`、`test-results/t02-review-tests.log`、`test-results/t02-review-typecheck.log`。这些回归只使用一次性容器/tmp，没有修改部署配置、重启原应用或重复浏览器截图。`script`和`setpriv`由已锁定的Linux checks镜像提供；本次权限结论限于该Linux容器，不扩展为未执行的Linux/WSL宿主矩阵。图定位与相关文件覆盖检查无已记录缺口（best-effort信号）。
