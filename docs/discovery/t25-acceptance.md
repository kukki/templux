# T25：共享包发布与隔离项目锁定消费验收

2026-10-15；Gitea #26，父#1故事5/7/8/15。审查基线`58de199c5965ae7eb4189130029809be0f96e17e`；实现提交及**最终发布来源**`66aa7c2d3f5f4fd921837e9804c4fc1d9cbb0bfa`，后续验收提交只补证据/测试。T03真实飞书组织人工验收仍pending。

## 设计与交付

具体设计先经Team发TL后执行，TL确认窄业务接口及归属方向。正式接口、禁止覆盖、SSR/client/资产、角色/范围扩展、私有分发/信任与基线合同见[shared-release](../specs/shared-release.md)。发布两个真正npm包，项目只有自己的骨架/业务和vendor依赖，不复制模板实现源码或整仓库充当消费。

core接纳现有T02–T24认证/授权/审计/会话/配置/CLI/维护/备份恢复及全部迁移；Web接纳现有页面、导航、维护提醒、元素、纯状态实现、样式及合成资产。保留内部相对路径减少重写，public exports显式限制支持导入。生产API无Next，生产Web无Fastify/pg，实际分开构建运行；私有工具不依赖Web。

新公共createProjectApplication只允许显式业务路径/已注册权限及scope/handler，复用真实Cookie/版本/权限、授权锁和事务、POST同源/维护屏障；changeProjectAccess在同事务执行项目变更/失效/强审计。未增加认证模拟入口。Web server抽出带明确Next目录的入口，旧模板仍复用同一实现；缺构建产物有结构化故障诊断。

## 最终产物（本地宿主授权获取，未外发）

目录：`test-results/t25/committed-releases/0.1.0/`。complete.json存在；manifest SHA256：

`bbf6ad9941a784e1301129a067698a79ff23cf2b8b81801582add184ec60c5dc`

| 产物 | SHA256 |
| --- | --- |
| templux-core-0.1.0.tgz | `2a0eddc6f11cbcc67449ba15cc6dcd987f88809d70989c75f03dca9fc5df9c05` |
| templux-web-0.1.0.tgz | `5ceecfb177bff0f77fe1ea54226b158294242c226a35eed124628e9031d0e142` |

每包SHA512另见manifest与npm package-lock。core130/Web113个常规文件逐一验过类型/路径，无链接、.env、秘密/凭据/备份/日志、tests/fixture、test-results、node_modules/.git或生成cache；默认presentation取shared默认值，不发布当前项目真实呈现值。198项**有界发布输入**哈希匹配checkout，78项core编译JS/声明匹配工具镜像；消费镜像安装后130/113个文件全部与原tar逐字节SHA一致，含package.json。

`committed-integrity.json`保存文件级哈希，`runtime-integrity.json`保存消费镜像对应：

- release-tools：`sha256:a9dd747a007f788e499032393230353cbe53b049a73f4d4595af604947ddd762`
- API：`sha256:91bac7c5804a56af73861eb8baa63846d47d856d5b712fe2e952b83ba59743ba`
- Web：`sha256:d187e0b6c2f736b21fdd1c073d619c2f8551632b7ea73e2c4826fd494ff83be5`
- management：`sha256:204a6aba7a5aac4f4351ed5b8e623a12e2adc309c8b73654c639ea2f49c99830`
- migration：`sha256:24b396fa89bcc29e3eb5b1fbef8dbe3553d781e6215fed45009c13b4ca89f74d`

## 构建与锁定验证

```sh
docker build --target release-tools -t t25-release-tools .
docker run --rm -e TEMPLUX_SOURCE_COMMIT=66aa7c2d3f5f4fd921837e9804c4fc1d9cbb0bfa \
  -v "$PWD/test-results/t25/committed-releases:/release" t25-release-tools
# 发布前API/Web typecheck与接口/归档专项在工具容器执行。
# 维护者仅复制发布project骨架到自有新目录，再按合同配置/构建。
```

隔离消费目录`/Users/jkoo/git/templux-t25-consumer-hjjpjxc4`，位于模板checkout之外。所有构建上下文是该目录；运行挂载只含新项目自身配置/维护/备份/凭据和管理socket，没有模板源码挂载。实际包依赖为准确版本文件名的file:tarball，manifest/templux.lock及npm锁SHA512共同固定，没有latest或范围。新项目业务版本1.0.0，共享0.1.0；项目自己的Quay品牌、横向导航、业务实现文字未被替换，哈希记录见`committed-project-ownership.json`。基线含原骨架/默认非秘密配置及文件SHA，不吸收新项目Quay定制。

API、Web分别独立`docker build --target api|web`成功，Web构建不编译API源码，API不编译Next。生产API resolve next失败、生产Web resolve Fastify/pg失败。最终host wrapper start从同一锁定产物重新构建标准目标并启动；JSON stdout整体可解析、构建及诊断在stderr。最终`typecheck-committed.log`：API/Web均0。历史SQL相对任务基线diff为空。

## 专项与核心回归

| 验证 | 结果/证据 |
| --- | --- |
| 新接口最初缺失 | interface-red.log为预期模块缺失；随后接口拒保留路径/重复/未知权限通过 |
| 发布验证器缺失 | release-red.log预期失败，随后GREEN；extra-red.log真实捕获旧实现未拒symlink/穿越及未知业务权限 |
| Web缺构建诊断 | web-diagnostic-red.log失败→GREEN；新旧入口统一使用显式项目目录 |
| 最终专项16/16，0skip | final-special-tests.log；实际SQL/HTTP测试文件最后只读挂入已提交实现镜像，不冒称镜像预含新增断言 |
| 核心回归105/105，0skip | core-regression-final.log：auth/password/session/account-management/login-methods/audit/maintenance/backup；这些后端实现与最终core逐字节一致 |
| 包控制11项 | 缺锁、hash损坏、有效同版本不同tar、范围依赖、unsupported、混版本、实际package身份、symlink/穿越/错误包版本；final-special-tests.log |
| 真实Docker前检拒绝 | invalid-build.log：把合法同名称/同版本tar重新打包并加文件，保持原受信锁，构建退出1，停在verify，不进行依赖安装/编译 |
| 非公开深层导入 | exports-private.log：auth-store私有子路径ERR_PACKAGE_PATH_NOT_EXPORTED；不把它当恶意代码沙箱 |

SQL/HTTP专项通过正式密码端点与正常CLI生成受限凭据，证明匿名401、scope403、POST跨源403、handler异常503且SQL回滚/诊断不泄漏。真实授权锁等待后账号版本已变，旧请求401。scope变更自身失败/关键审计注入失败均使项目SQL与auth_version回滚。另用**DEFERRABLE约束触发器在COMMIT持真实PG锁**：handler已结束但HTTP尚未返回，其他连接看不到新行；释放锁后才200。不是仅看handler调用次数或类型检查。

## 最终已提交产物的新项目闭环

`python3 tests/scenarios/release-consumer-proof.py`，最终日志`consumer-proof-committed.log`与`consumer-proof.json`：**7个行为场景+1个complete标记**。

| 场景 | 实际观察 |
| --- | --- |
| 标准启动/真实SQL | 新项目空库迁移到0010，business1.0.0/shared0.1.0；Web不自行迁移 |
| 人员与项目权限 | 正式密码登录，零角色保护403；user可保护页200但业务permission403；显式user+reviewer并集后业务200、他人accountId范围403；每次CLI改角色旧会话401；普通管理API403 |
| 独立Agent | 真实责任人关联、随机0600文件；零角色403，明确reviewer授权后业务200，旧会话401；未复用人员凭据 |
| 页面/管理/审计 | /account、/business、/examples均真实SSR200且Quay品牌；管理员账号/审计API200，普通403；生产fixture授权URL404 |
| 迁移/backup资源 | 包内migrate --check返回0010；实际pg_dump/归档完整性成功，指定新项目宿主backups里0600产物SHA一致，未错用容器路径作宿主bind |
| independent restore资源 | 包内工具实际恢复新项目归档至预先创建自有独立库，3账号保留、全部旧持久会话0、结果completed-offline；当前源连接及原Cookie仍200，没有自动切换或开放目标 |
| maintenance资源 | 持久提醒→取消；halt保留entry维护503，显式resume后保护200，包内模板配置/入口回执/SQL资源路径有效 |

常规状态/密码/Agent/强审计继续使用真实Postgres；外部Feishu仅既有隔离协议模拟核心回归，未新增生产认证fixture，也未声明真实组织验收完成。独立恢复目标保持offline，未另外部署其Web模拟生产切换；T23全部恢复故障矩阵未在本票重跑。

## 浏览器与截图

Ego只创建自己的TaskSpace77，正常读取新项目登录页；截图Page.captureScreenshot超时，首次点击后立即goto也取消了未完成登录。没有把这次结果当成功。按授权fallback，版本化`release-browser.mjs`启动独立临时Chrome profile，经自己的CDP输入用户名/密码并真实点击表单、等/account成功；不注入Cookie、不用个人profile/Ego31。最终从已提交产物复跑`ego-browser nodejs < tests/scenarios/release-browser.mjs`成功，见`browser-committed.log`/`browser-proof.json`。

- `business-desktop.png`：1440×1000，项目品牌/横导航、项目业务响应和共享只读表格。
- `business-narrow.png`：390×844，文字菜单入口、表内横滚，页面scrollWidth=390无横溢出。
- `examples-narrow.png`：包内示例实际渲染，2个搜索输入/45个按钮及现有元素。
- `revoked-login.png`：CLI变更该自有人员角色后online事件触发实际会话检查，自动到/login?reason=authorization_changed。

以上为真实截图，作者查看了桌面/窄屏；不以像素差作为门禁。Headless触屏尺寸是仿真，不等同真实手机软键盘/OS。Ego任务77已关闭，fallback profile/process由finally移除。

## 调查、失败记录与限制

codebase-memory index→createApplication/requirePermission搜索→双向trace→snippet；相关既有/新增文件和49个改动路径coverage，最佳努力非完整图证明。.dockerignore/tsconfig不跟踪诊断已直接读（coverage-direct-fallback.txt），旧SQL解析缺口此前直接核对、生产SQL未改。Context7核对npm pack/workspace/integrity、Node24 exports、Next transpilePackages、Fastify promise/error语义；Postgres技能用于事务/锁/恢复相关工作。

诚实保留早期失败：Docker Desktop原生fs.cp在发布bind生成0200文件导致EACCES，两个未完成目录没有complete，改显式read/write/chmod后成功；首次业务页误给error状态rows被真实Next类型检查拒绝，修正消费者状态；首次105回归缺TEST_WEB_URL导致password-form子项及父项失败，配置自有Web后105/105；shell-only APP_PUBLIC_URL未投影到management，嵌套Compose回默认31000导致登录403，改用新项目自身受限.env，最终重跑全闭环。发布输入最初包含生成tsbuildinfo，排除后198项均匹配源码。上述候选没有当最终发布或通过证据。

只验证macOS宿主、Linux容器、Node24/PG18.6/Next16.4，未扩为Linux/WSL宿主与所有历史版本矩阵。包清单静态校验组合，独立部署需维护者核对双方manifest，不声称运行时跨版本自动握手。未新增registry/云发布/签名信任基础设施、项目生成器、每日检查/升级补丁/自动合并/部署；T26等后票及最终全范围验收仍另行推进。

## 清理与保留

cleanup.json记录：删除自有t25-consumer容器/数据库/维护卷/网络、t25-auth数据库/网络、私有.env/凭据/归档/HMAC/Cookie、无效项目及早期产物候选；镜像、最终committed-releases发布物、safe证据/截图与**非秘密新项目源文件/config/vendor/原基线**保留供审查。原0004项目、.env、现用presentation、Ego31/真人/飞书未迁移、重启、停止或授权。本地提交，不push、不关闭#26，交TL独立审查。
