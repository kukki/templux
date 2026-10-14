# T08 独立审查：身份验证关联与随机密码交付

日期：2026-10-15；审查者：审查。范围 `cdf61c61e7ecca5b4c44ef67a8833992285662fb..efb124f54aa20f00f7b04dd744da6e61d30031b3`，开始时 HEAD 为后者且工作树干净。按 Team 权限由同一独立审查者依次完成两轴，未新增成员或修改实现。

## 结论

| 轴 | 结论 | 发现 |
| --- | --- | --- |
| Standards | 未发现需另立的仓库规范违规；结构、配置和事务边界符合既有方向 | 0 |
| Spec | 暂不按 #9 验收；先修复以下两项并定向复核 | 2项P2 |

完整回归119/119和类型检查通过，但没有覆盖下面的回调交错及本人首次启用指引场景。P2表示需要修复的具体行为/合同缺口，不据此宣称存在未认证授权绕过。T03真实飞书组织人工验收仍另列。

## F1 · P2：被第二次开始替换的关联回调会退回普通登录

**位置**：`apps/api/src/login-methods.ts:51`、`:55`、`:56`；`apps/api/src/auth-routes.ts:70`、`:74`、`:75`、`:76`。

**触发**：目标通过新鲜密码会话开始关联OAuth。第一个回调通过state/browser校验并消费持久state，正在等待远程token/user_info兑换。此时目标再次开始同一关联请求，新的begin更新该请求的oauth_state_hash。旧兑换完成后，verifyFeishuLink按旧hash查不到请求并返回false，callback将其当普通OAuth登录执行registerSession。

**实际复现**：隔离Postgres、正常HTTP密码登录、仅外部Feishu transport设置可控等待。等第一个token兑换进入等待后执行第二次正常begin，再释放兑换：旧回调返回302 `/account`，设置新的templux_session；该Cookie对应新建Pending账号6，而原关联目标为账号5；原关联请求仍pending。复现输出只记录状态、账号ID与是否发行Cookie，不输出Cookie/秘密。正常非交错的关联回调仍仅标记verified。

**影响/合同**：`docs/specs/login-methods.md:14`明确旧关联回调不能退回普通登录、关联回调不能发行新会话。当前旧回调会切换浏览器账号，并可能创建独立Pending身份而使后续同subject关联发生占用冲突。远程身份仍经过exchangeIdentity验证，此复现不是伪造飞书身份、不是把该身份直接绑定到原目标，也未证明提升权限；问题是关联目的在兑换等待期间丢失。

**建议**：持久保存OAuth的用途及不可变请求关联，在成功消费state/browser时原子捕获该上下文，再兑换身份。关联用途的回调在请求映射被替换、取消、过期或版本变化后必须明确拒绝，不允许通过“查不到映射”回退普通登录。补充“消费state后停在兑换→第二begin→旧回调恢复”的真实SQL/HTTP回归，断言无新session/账号/身份写入且新请求仍可正常验证。不要在SQL事务锁内等待远程网络。

## F2 · P2：本人首次启用密码的页面CLI指令无法完成操作

**位置**：`config/auth-copy.json:120`、`apps/web/app/components/login-method-manager.tsx:25`、`:26`；`apps/api/src/login-methods.ts:72`、`:90`。

**触发**：只有飞书方式的管理员为自己创建password请求，正常重新飞书登录并验证；Web最终完成正确返回409 self_password_change_cli。页面对本人统一显示 `templux reset-person --account <ID> --credential-file … --confirm --non-interactive`，而resetPersonPassword只允许已有password_credentials的人员。首次启用没有该记录，照页面操作必然失败。已verified的本人password请求仍显示“确认完成关联”网页按钮，不能代替对应CLI指引。

**实际复现**：正常模拟外部OAuth登录已有Feishu-only管理员，真实SQL/HTTP创建和本人验证后，Webcomplete409；实际spawn管理CLI执行页面reset-person指令，exit1、错误“目标尚无已验证密码方式，请先发起启用请求。”；改为 `complete-login-link --request <已验证请求ID> --credential-file 新文件.json --confirm --non-interactive` 则exit0，凭据文件0600，普通stdout/stderr不含随机密码。说明后端安全限制正确，页面给错操作。

**影响/合同**：`docs/specs/login-methods.md:26`要求本人密码启用/重置有对应ID可执行CLI指令。目前本人首次启用需自己查文档纠正命令，照提示不能完成。

**建议**：区分本人已有密码重置与已verified的password请求完成；后者提供包含requestId、credential-file和显式确认的complete-login-link完整命令，同时不给必然409的Web完成按钮。保留已有密码reset-person与本人feishu关联的正常入口，文案集中管理。补一个Feishu-only本人管理员的实际CLI与页面指引验收。

## 已核对范围与正常证据

读取 Gitea #9/#1、ADR0024及既有认证/事务规范、login-methods合同、验收、计划与全部34文件差异。检查新0006和原0001–0005不变；未对部署0004迁移或重启。

- Web/CLI共用锁内managementOperator、target版本、请求状态/期限、身份域与唯一冲突检查；浏览器不能提交subject/actor/proof替代验证。Fresh检查使用持久created_at及clock_timestamp，等于5分钟拒绝；15分钟请求固定目标/版本；验证不审批或授角色。
- 人员/Agent区分、已有身份不替换、不按姓名邮箱合并、每人员realm唯一索引及跨目标同subject并发；请求、验证、最终关联、重置关键审计同事务。正常关联、重置使密码/飞书旧会话均失效，保留账号状态/角色、停用密码enabled及T07组合失败限制。
- KDF在事务外、最终仍锁内重验操作者。CLI文件沿用exclusive/O_NOFOLLOW、0600、host属主、fsync；已知回滚清理，COMMIT未知保留并提示核对。Web只对他人生成密码、单次no-store/no-cache响应，代理透传头；credential局部Blob下载，无查询复取、React状态/DOM/storage写入或日志输出。
- 客户端下载异常发生在COMMIT确认后显示已提交但交付失败，未知网络/COMMIT不自动重试；刷新目标版本再明确重置。发行API没有tests/fixture；auth-browser只在工具镜像模拟外部协议。

结构按codebase-memory search→trace→snippet探索，检查全部34变更文件及feishu/password/limits/session/Compose/Dockerfile/ADR/domain依赖覆盖：metadata_match、无记录缺口。信号为best-effort，SQL仍直接完整读取。Postgres技能用于约束、同客户端事务及授权锁；Context7核对React过期response清理与Fastify敏感响应头。

## 本次独立执行

| 验证 | 结果与证据 |
| --- | --- |
| checks以明确独立DATABASE_URL运行migrate | 空临时库应用6项，schemaVersion0006；工具命令实际输出 |
| `docker compose run --rm --no-deps -e TEST_API_URL=http://password-api:8080 -e TEST_WEB_URL=http://password-web:3000 checks npm test` | 119/119，fail/cancelled/skipped均0；`test-results/t08-independent-suite.log` |
| `docker compose run --rm --no-deps checks npm run typecheck` | API/Web退出0；`test-results/t08-independent-typecheck.log` |
| checks挂载 `test-results/t08-review-reproduction.mjs` 到tests目录执行 | F1/F2均实际复现；`test-results/t08-independent-reproduction.log`。脚本退出0表示确认现有缺陷，不能解释为合同通过。 |

补核先断言 `/templux_auth_test`；账号、关联、会话、OAuth与凭据全部自有，finally清除记录/私有文件。仅模拟外部Feishu响应和等待，权限、session发行、版本、审计及CLI为实际SQL/HTTP/子进程。

开发 `t08-browser-evidence.json` 提供他人下载、目标正常验证、零角色同ID/业务403、下载异常后再次明确重置恢复及390px布局证据；`t08-secret-scan.json`为37文件无秘密命中及宿主0600/UID501/GID20。已读取核对，本次未重跑完整浏览器，也未将其标为审查者实际浏览器执行。开发backup-restore日志显示隔离恢复0005且0006表不存在，本次未重复恢复演练；历史迁移差异核对为空。

已清理本次password/SSR/auth-database工具容器；原API/Web/database持续原镜像healthy，无实现/.env/部署/真人权限改动，未推送/关闭工单。

## 协议与局限

本次重新抓取飞书官方完整授权码395行、token v3 544行、user_info 408行材料，核对固定官方端点、一次性code/state、Confidential Client secret表单和Bearer user_info租户身份来源；不存远程token到关联表。旧token文档路径重抓只得到“文档不存在”，沿官方正文引用切换get-user-access-token-v3后取得完整材料（test-results/t08-review-feishu-token-v3.md）。官方PKCE为可选增强，本票复用既有Confidential Client流程。真实组织授权及关联冲突仍需正常个人验收，不能用本次协议模拟证明T03已完成。

- F1用受控外部等待稳定模拟实际网络交错，没有调用真实组织、未操作Ego31。
- F2核对页面源代码/集中实际文案并实际执行该CLI指令，没有重新录制本人浏览器完整流程。
- 浏览器落盘/私有目录权限、安全渠道交付、真实TLS、Linux/WSL2矩阵和网络COMMIT回包丢失未新增演练；无自动保证文件安全交付的声明。
- 未对本票无关主题/安装/性能重新构建或增加测试；后续票仍独立验收。

官方来源：[授权码](https://open.feishu.cn/document/common-capabilities/sso/api/obtain-oauth-code)、[token v3](https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/authentication-management/access-token/get-user-access-token-v3)、[user_info](https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/authen-v1/user_info/get)。
