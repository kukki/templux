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

## 附录：2026-10-15 S1/F1 修复独立定向复核

复核范围：`d4cccf4202fdc697f56ea0be06458c3cd60f0cad...97fb0b870ebd07a05102487a917d5c227c18ca01`。本附录补充最新结论，上述初审历史保持原样。按TL指示继续由同一独立审查者分别检查Standards/Spec，未创建额外成员。

### Standards：S1关闭

`apps/api/src/manage.ts:80`现在只在菜单入口或显式 `--interactive` 时进入初始化字段补齐；必填名称、确认、已有文件覆盖保护仍由原初始化逻辑校验。呈现合同同步说明完整TTY命令直接执行以及可选值的默认/保留语义，符合ADR0025及CLI规范。

本轮再次在真实PTY执行原触发命令：

```sh
docker compose run --rm --no-deps \
  -e TEMPLUX_CONFIG_PATH=/tmp/t02-review-complete-fixed.json \
  management init --name ReviewComplete --confirm
```

未发送任何品牌/主题输入，直接输出“完成：init”，退出0。独立重跑的真实TTY回归还验证：已有文件缺 `--overwrite` 时立即退出1且内容不变；显式覆盖退出0且未指定品牌保留；菜单7和显式interactive仍按实际提示收集名称/品牌/配色并确认。

### Spec：F1关闭

`apps/api/src/initialize.ts:44`在发布前对新文件也显式chmod0644，已有文件继续采用原模式；之后设置属主/组，元数据处理失败仍进入catch/finally清理且不会发布。呈现合同同步说明新文件权限不受进程umask截断。

本轮复用checks镜像，在一次性容器临时目录按原条件独立执行：`umask 077`，新文件路径、HOST_UID/GID1001，实际调用 `manage.js init --name New --confirm --non-interactive --json`；再用子进程uid/gid1000调用共享 `loadPresentation()`。结果：init退出0、mode=644、uid=1001、gid=1001，服务读取退出0且名称为New，目录只有最终文件、暂存残留为0，临时目录已清理。该检查使用实际不同UID，不仅检查模式。

本轮重跑回归还验证已有0660在umask077覆盖后模式和属主组不变；无效宿主UID引发发布前元数据失败时退出1、目录无最终文件或临时残留。

### 验证、结论与局限

- 独立执行 `docker compose run --rm --no-deps checks npm test`：18/18通过，0失败、0跳过，退出0，包含上述TTY及权限回归和真实默认安装API/Web读取。
- 独立执行 `docker compose run --rm --no-deps checks npm run typecheck`：API/Web均通过，退出0。
- `git diff --check d4cccf4...97fb0b8`退出0。已核对开发的旧镜像回归失败日志 `test-results/t02-review-regression-red.log`，两项原条件确实分别因可选输入挂起和服务读取失败而失败；修复后通过。构建/测试/类型检查日志与新增验收说明一致。
- 复核了全部6个变更文件。初审记录原样纳入提交，合同修订是两项已要求语义的澄清；实际代码修复仅管理入口条件和chmod，没有扩大功能范围。
- codebase-memory当前generation为 `2026-10-14T16:27:04Z`，读取管理及初始化符号原文；6个本轮证据文件和相关scope均无已记录覆盖缺口，仍为best-effort信号。此次未涉及框架行为变化，沿用初审Context7文档核对，不重复查询。

**最新Standards：S1已关闭，无新增发现；最新Spec：F1已关闭，无新增发现。结合初审其余范围检查及本次实际复核，T02可按#3范围验收，现无审查阻塞项。** 此结论只针对T02，不代表完整首版完成；工单关闭由TL决定。

复用更新镜像，没有重建Web、重跑隔离安装或截图，也没有更改部署配置、重启原服务。此前日志/截图证据及平台局限仍适用；本轮权限实测限于Linux容器，未执行完整Linux/WSL2宿主矩阵、ACL/xattr、多进程并发或掉电恢复。审查阶段只追加本文件，并仅本地提交审查记录。
