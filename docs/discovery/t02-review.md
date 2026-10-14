# T02 独立审查

日期：2026-10-15（Asia/Hong_Kong）。范围：`72c69f8...d4cccf4202fdc697f56ea0be06458c3cd60f0cad`，含 `ccb5fa3`、`d4cccf4`，22个变更文件。HEAD与指定终点一致，未改实现、未推送、未关闭工单。

依据：已通过 Gitea `issue_read` 读取 Swython/Templux #3 与父规格 #1；对照项目呈现合同、CLI规范、CONTEXT及 ADR0012/0013/0014/0025/0026。使用 code-review、codebase-memory 与 verification-before-completion 技能。按 TL 明确指示及 Team 权限，由同一位独立于实现者的审查者依次进行两个轴的检查；没有两个并行子审查，此流程限制不单独阻塞功能验收。

## Standards

**1项 P2，需修改。**

### S1 / P2：参数完整的 init 在终端中仍等待可选输入

- 位置：`apps/api/src/manage.ts:80`、`apps/api/src/initialize.ts:13`。
- 规则：ADR0025明确“完整参数直接执行”；`docs/specs/management-cli.md` 也要求完整参数的一行脚本共用校验及执行逻辑。项目呈现合同声明 `--brand`、`--theme` 可选；未指定保留或使用默认值。
- 触发：交互终端中传入明确命令、必填名称与确认，省略可选品牌或主题，且不传 `--non-interactive` / `--json`。已有文件同时提供 `--overwrite` 也会出现。
- 实际复现：PTY执行 `docker compose run --rm --no-deps -e TEMPLUX_CONFIG_PATH=/tmp/t02-review-complete.json management init --name ReviewComplete --confirm`，停在“品牌文字（已有配置留空保留，新文件留空使用项目名称）：”，尚未执行初始化。审查者随后发送 Ctrl-C结束一次性容器。
- 原因：只要 stdin/stderr 是TTY即开启补齐，对所有缺省可选值也调用 readline，不区分菜单、显式交互补齐与完整命令。
- 建议：保留菜单和 `--interactive` 的补齐；显式完整命令使用可选参数默认语义直接执行。增加真实TTY回归，验证必填参数与确认齐备时无需品牌/主题输入；保留已有文件覆盖保护。

未发现其它需要报告的仓库规范违例或具有实际维护影响的基线代码异味；此结论限于指定差异及其相关调用。

## Spec

**1项 P2，需修改。**

### F1 / P2：新配置的0644合同受 umask 改写，成功初始化后服务可能读不到

- 位置：`apps/api/src/initialize.ts:43`、`apps/api/src/initialize.ts:44`。
- 需求：#3要求明确校验、初始化失败结果及独立副本可启动；项目呈现合同“新文件由包装传入宿主 UID/GID并使用0644”。
- 触发：配置不存在，管理容器进程使用 `umask 077`，传入宿主 UID/GID 与运行服务的 node UID/GID不同。仅对已有文件调用 chmod，新文件 `writeFileSync(...mode:0644)` 实际被 umask 截成0600，再 chown给宿主。
- 实际复现：复用 checks 镜像，在容器临时目录运行 `sh -c 'umask 077; exec node apps/api/dist/manage.js init --name New --confirm --non-interactive --json'`，环境配置路径指向新文件、HOST_UID/GID=1001；init退出0，文件mode=600、uid=1001。随后以服务相同的uid/gid=1000调用 `loadPresentation()`，退出1，报“无法读取呈现配置，请检查文件存在、权限及 JSON 格式。”
- 影响：命令报告成功，但新配置无法由另一个服务身份读取。默认宿主包装创建的普通管理容器使用默认umask时未复现此故障；该问题是容器CLI入口在受限umask下的合同边界，不能据此声称普通宿主umask会自动传入Docker。
- 建议：提交文件前显式设定新文件0644，已有文件仍保留原权限，并检查最终属主/组。补充新文件受限umask及不同宿主/服务UID的读取回归。

其它T02要求的检查结果：配置与.env隔离、递归拒绝未知字段/错误类型、颜色/语言/时区/分页/通知校验、完整导入优先与未指定字段保留均有源码和容器测试支持；失败写入保留原文件；同目录原子替换及新建排他链接可见于实现。API启动与前端首次请求使用进程快照；统一配置改变后重启生效的现有隔离验收日志与测试脚本一致。品牌Logo替换、页头页脚隐藏替换、版本版权、简中文案及香港到秒时间已接入。导航/元素仅保存后续消费的默认值，未提前增加个人设置、来源业务数据或目录生成器。

## 实际验证与现有证据

- 本轮独立执行 `docker compose run --rm --no-deps checks npm test`：14/14通过、0失败、退出0，包含真实默认安装的API/Web读取及CLI测试。
- 本轮独立执行 `docker compose run --rm --no-deps checks npm run typecheck`：API/Web通过、退出0；没有重建镜像。
- 针对性容器检查：以uid1000在不可写目录覆盖合法配置，退出1，原内容完全保留且无临时文件；同一进程读取后修改磁盘文件，`presentation()`保持原名称。测试数据仅位于一次性容器的 `/tmp`，已清理。
- 两项上述问题均由本轮独立容器复现，未写入或重启原项目配置及服务。
- `sh -n templux tests/presentation-installation.sh`、`git diff --check 72c69f8...d4cccf4`退出0。
- 已读取开发的 `t02-test.log`、`t02-typecheck.log`、两组 `t02-installation*.out` 及其脚本。两组安装记录均包含独立复制、Logo HTTP200、快照保持、镜像ID相等、重启变体、隐藏区域、无效配置拒绝的PASS；未重复两次昂贵完整构建，这部分是核对现有证据而非本轮重跑。
- 人工查看浅蓝1440×1000与深褐390×844截图，品牌、版权、版本及时间可见，内容未见裁切；其余配色/滚动情况仅核对开发记录及CSS，不宣称重新运行全套浏览器验收。
- Context7先resolve Next.js、再query `/vercel/next.js` 的 connection/运行时读取文档，确认 await connection() 后的读取排除构建预渲染。安装版本16.4.0不在Context7返回的版本列表中，文档是当前官方分支材料；两组实际重启日志提供本项目行为证据。
- 图索引项目 `Users-jkoo-git-Templux`，generation `2026-10-14T16:14:19Z`；图查询与双向追踪确认 presentation → loadPresentation/validatePresentation，以及API、Page、Layout、metadata调用。两批覆盖检查涵盖33个证据文件及相关scope，无已记录缺口；`apps/api/tsconfig.json` freshness为not_tracked，已直接读取该变更。图覆盖是best-effort，不证明全仓库完整。

## 结论及局限

Standards：1项P2（S1）；Spec：1项P2（F1）。两轴均建议修复后再验收；无P0/P1高严重性故障。现有14项测试与类型检查通过不覆盖这两个触发条件。

本轮只审查T02范围；未执行完整Linux/WSL2宿主矩阵、多进程并发故障注入、ACL/xattr、持久化掉电恢复或所有视口浏览器重跑。并发已确认覆盖采用最后成功写入是合同已说明的边界；未将其当作缺失三方合并。新文件umask问题的复现为Linux容器内受控CLI调用，不扩展为所有常规部署必然失败。
