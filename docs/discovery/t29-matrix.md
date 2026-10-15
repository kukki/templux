# T29 完整父矩阵与证据分类

2026-10-16 平台范围按 [用户决策](../specs/deployment-platforms.md) 更新：Ubuntu UAT/生产，macOS 可选开发，Windows/WSL2 移出范围而非通过；下述原演练来源与实测结果不变。

基线 c02ac42859b7140a5e76f7b4126b18973bbdd84f。`新执行`仅指本票真正执行；`复用`不冒充本票重跑；`未执行`仍是验收缺口。实际候选版本、manifest/包/工具/source hash及最终结果由 t29-acceptance.md 和 test-results/t29 清单绑定，不能据下表计划列先宣称通过。

| 父规格验收组 | 能力/产物 | 本票执行入口 | 固定范围历史证据 / 现状 |
|---|---|---|---|
| 独立启动及配置 | core migrate/manage + project Docker/Compose/config + Web | t29-suite.py；新消费 init/start/config重启；API/Web分目标构建 | T02/25：配置重启、无效拒绝、组合拒绝；本票517与对应consumer-proof/restore证据通过，具体边界见验收 |
| 首次授权 | core Feishu OAuth/组织/Pending/CLI | 全suite auth/login-methods真SQL+模拟外部协议 | T03官方真实组织人工仍未执行；模拟不等价真人 |
| 账号及Agent | core密码/独立Agent/责任人/环境策略 | 全suite password/login-methods；新消费普通页面密码登录 | T04/08/25受限文件/PROD默认/验证关联；本票517与对应consumer-proof/restore证据通过，具体边界见验收 |
| 管理不变量 | core共享锁/最后管理员/网页API | 全suite admin-availability/account-management/auth | T04F1/06并发与审计；本票517与对应consumer-proof/restore证据通过，具体边界见验收 |
| 会话 | core持久auth_sessions/version/退出与restore | 全suite session；新消费重启/撤权/恢复旧401新200 | T05/23真实恢复八段；本票517与对应consumer-proof/restore证据通过，具体边界见验收 |
| 闲置及心跳 | core时限 + Web guard/编辑绕过 | 全suite session/ssr-body；浏览器正常撤权 | T05/T14：真实online、dirty优先/403网络；历史DOM点另外标注 |
| 登录限制 | core Postgres失败组合与代理链 | 全suite password-limit真SQL多实例/并发/时间 | T07来源IP/反伪造边界；本票517与对应consumer-proof/restore证据通过，具体边界见验收 |
| 审计故障 | core强审计/成功登录例外/查询留存日志 | 全suite audit/account-management/login-methods/maintenance | T09及F1配置拒空、T25事务COMMIT；本票517与对应consumer-proof/restore证据通过，具体边界见验收 |
| CLI | 宿主wrapper+容器manage/工具CLI | 全suite cli/presentation/restore/updates-wrapper；新消费macOS入口 | Ubuntu 真实宿主未执行；macOS 为开发实测；WSL2 已移出范围 |
| 备份恢复 | core pg_dump/restore + migration/start/maintenance | 全suite backup/restore/migration-objects；新消费明确original/independent目标 | T22F1/AM、T23/24：类型/AM、失败闭合/迁移阻断；本票517与对应consumer-proof/restore证据通过，具体边界见验收 |
| 搜索多选 | Web元素/state/examples | 全suite search/multiselect/examples；新消费真实页面 | T11/12/F1实际IME/触屏/双计时，按源hash复用；本票browser-proof，未改原生细节按固定来源复用 |
| 分页排序及空结果 | Web list-state/pagination/readonlytable | 全suite list-state/examples；新消费页面分页/滚动 | T13真实URL/三态/历史/窄屏图，按源hash复用 |
| 表单弹窗及内联行 | Web editor/EditSession/dialog/row | 全suite editor/deadline；实际examples关键保存/关闭 | T14F1/F2/F3/T15实际组件与浏览器；本票browser-proof，未改原生细节按固定来源复用 |
| 通知与维护 | Web通知独立channel + core持久maintenance/entry | 全suite notifications/maintenance；新消费halt/resume/提醒刷新 | T16F1受控时间/8组件、T21写屏障/在途；本票517与对应consumer-proof/restore证据通过，具体边界见验收 |
| 图片复制及面板 | Webimage/copy/overlays/state | 全suite image/copy/messages/overlays；新消费页面 | T17F1–F3/T18/T19F1受控组件与真触控；T28受审复制真实页面，原生权限不复测 |
| 响应式及示例 | Web壳/导航/config/examples | 全suite navigation/examples；新消费桌面窄屏截图/移除路径 | T20四主题×横纵×桌面窄屏16张固定源图，T10物理移除；本票7张真实代表图/config-variant-proof |
| 发布及升级 | 两npm+locks/baseline+独立upgrade/discovery toolkit | 新候选实际tar/安装；定制提案/冲突/缺基线/语义失败/一次性采用 | T26最终快照/完整patch等价；T27两边累计真实检查/调度及F1/F2；T28独立贡献与B采用；本票517与对应consumer-proof/restore证据通过，具体边界见验收 |

## 平台与浏览器

| 平台 | 实际执行条件 | 状态 |
|---|---|---|
| macOS 可选开发 | 26.6.2 arm64，Docker Desktop29.8.2 Linux arm64，基础Shell/Python/Git及浏览器工具 | 既有开发实测保持；精确命令/退出码见验收与冷安装补验 |
| Ubuntu UAT/生产宿主 | 尚未提供可访问的授权隔离主机；版本/架构待定，目前只有Docker Desktop Linux VM/容器 | 未执行，不承诺全部Ubuntu版本/架构，不能用容器冒充 |
| Windows/WSL2 | 用户已移出支持与交付验收范围 | 不再要求补验；不是已通过 |
| 真实组织Feishu | 未取得本人授权，Ego31不操作 | 未执行，与密码/协议模拟结果分离 |

Ubuntu 待验环境沿用同一隔离复跑入口：仅在获授权的全新目录取得精确交付 source/manifest/vendor，核 SHA，按 README 容器 init/start，再运行新消费驱动/restore/upgrade。执行前记录 Ubuntu release、宿主架构、Docker/Compose 版本与独立空闲端口；核对文件权限/UID/GID/路径、PTY菜单/完整参数/JSON及清理。未提供环境前保持未执行，不自动操作现用 UAT/生产。macOS 默认网络冷依赖的后续实际通过及边界见 [独立复核](t29-cold-install-review.md)，不外推 Ubuntu。#30/父#1 仍受 Ubuntu 与真实 Feishu 验收缺口约束，WSL2 不再是待补项。
