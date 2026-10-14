# T04 F1 修复验收

日期：2026-10-15。修复基线 `a71e22a51cfa31afb88ad8bec56457c4aef266f3`（实现978de78，含独立初审）。保留 `docs/discovery/t04-review.md` 初审结论，不修改其历史。

## 核验与最小修复

采用receiving-code-review/systematic-debugging，先读取初审和审查脚本，在独立templux_auth_test迁移后准确复现：无飞书配置的历史身份及匹配realm但缺Secret均允许CLI降权最后密码管理员退出0；三项无方式/disabled密码/不匹配对照正确拒绝。日志 `test-results/t04-f1-reproduced.log`。首轮空tmpfs无schema，先按既有迁移入口初始化再复现，没有把准备失败当作问题结论。

根因：授权SQL以null通配历史飞书身份，身份域元数据也不能证明完整飞书配置可用。修复精确匹配非空可用身份域。共享配置模块从API完整配置校验派生版本化公共投影，一次性API镜像探针与API复用Compose auth-environment；宿主包装只转交非秘密投影。管理镜像仍无Secret且要求投影，校验身份域/Agent策略一致后才能变更。没有手填enabled布尔配置，没有Web在线依赖，没有新迁移、生产fixture或授权API。

投影校验失败拒绝授权；包装仍转交空失败结果给管理层以保留其它修复命令。宿主已获Docker/DB权限是信任边界，不声称防止宿主管理员自行绕开管理规则。配置修改仍要求重启API；探针完整配置通过不代表真实组织凭据已验证。

## 命令与证据

- 构建仅checks/management/api/auth-config-probe：`t04-f1-final-build.log`，退出0；未重建Web或重跑截图。
- 定向新回归8/8、0失败/跳过：`t04-f1-regression.log`。完整配置飞书通过模拟外部协议的正常OAuth回调，实际SQL会话/admin200；随后无Secret管理进程接收探针公共投影，CLI降权退出0，飞书管理员仍admin200。测试模拟仅外部协议。
- 实际 `./templux authorize --account 1 --roles user --confirm --non-interactive --json` 对独立SQL测试账号运行三次：无配置退出1，匹配realm但无Secret退出1，完整合成配置退出0；`t04-f1-wrapper-{disabled,no-secret,enabled}.{json,log}`。合成配置通过调用环境提供，不修改.env、部署库或真人角色。
- 一次性management容器仅布尔检查：secretPresent=false、projectionRequired=true；不输出值。公共投影/stdout/stderr断言不包含合成Secret。
- 新回归同时覆盖三个正确对照、拒绝后状态/角色/版本/审计未提交、原密码会话仍admin200、投影空值/无效/冲突/缺失、Secret空白、身份域空白、API同源回调/公开地址/会话策略/别名冲突的相同校验。
- 初始专项新测试仅因Fastify inject返回多条Set-Cookie为数组而失败；按真实Cookie名称选择后通过，未改变认证行为或弱化预期。

最终完整suite、typecheck及清理结果见本记录末尾的最终交付段。

## 范围

沿用真实SQL/CLI/API边界及隔离tmpfs库。原并发最后管理员、密码、Agent环境/责任人保护均由完整套件复验。未操作Ego31或.env，不授予真人权限，不推送/关闭工单。平台macOS/Docker Desktop/Linux容器；未重跑无关浏览器/完整宿主平台矩阵。T03真实组织验收仍未完成。

## 最终交付验证

`./templux test --non-interactive --json`：**58/58通过，0失败/跳过、退出0**；`./templux typecheck --non-interactive --json`：API/Web通过、退出0。证据 `test-results/t04-f1-final-{test,typecheck}.{json,log}`。原并发最后管理员、密码及Agent/责任人回归全部通过。

仅部署API更新到当前后端镜像，`t04-f1-api-start.log`健康；Web没有重新构建。故意给一次调用传入不合法合成回调时，探针拒绝但 `./templux status --non-interactive --json` 仍成功退出0（`t04-f1-recovery-status.{json,log}`），证明其它运维修复命令不被全局阻断；未修改部署.env。

`sh -n templux tests/presentation-installation.sh`、`git diff --check`通过。已移除隔离auth-database，探针/管理一次性容器均自动删除，部署API/Web/database健康；没有新浏览器空间或密码文件。

codebase-memory重新索引，修复证据8条路径检查覆盖无记录缺口；信号best-effort，未宣称全仓证明。Context7先resolve Node.js并核对当前运行工具/子进程文档；最终实现采用既有Compose包装参数及专用配置探针，未新增通用执行框架。
