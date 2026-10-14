# T10 独立审查：受保护示例入口与移除合同

日期：2026-10-15；审查者：审查。范围 `8c114cfef8c81653de07ec98c3fe4a11afc9f81b..020b9405bf6d955ec375b13361f14c673b12d1d6`，开始时HEAD为后者、工作树干净。依Team权限由同一独立审查者依次完成Standards/Spec，没有新增成员。

## 结论

| 轴 | 结论 | 发现/阻塞 |
| --- | --- | --- |
| Standards | 通过；范围内未发现需修复问题 | 0/0 |
| Spec | T10代码与可独立验收范围可按 #11 验收 | 0/0 |

已读取Gitea #11/#1、ADR0007/0008/0012/0013/0021、示例规范/实现合同、验收、计划及全部21文件差异。本结论是独立受保护入口、内存样例及移除合同，不把T11–T20完整控件行为作为本票缺失，也不代表完整首版交付。T03真实组织人工验收仍另列。

## Standards核对

- 示例目录仅单向依赖通用shell/profile/SessionGuard/presentation；data、client lab、样式及独立文案都在独立边界。正式account只引用通用features和入口标签，不import示例目录或独立文案；源码字面查询只有page/lab自身引用examples-copy，graph的projectFeatures四个调用者符合预期（`apps/web/app/examples/page.tsx:1`、`apps/web/app/account/page.tsx:17`）。
- shared/features集中校验auto/true/false和DEV/UAT/PROD，未设置才默认、显式空/非法拒绝；Web启动及CLI start/config-check复用同一函数，不引入互相不同的布尔解释（`shared/features.mjs:2`、`apps/web/server.mjs:8`、`apps/api/src/manage.ts:88`）。Compose公共/测试环境保留显式空，无此类静默回退。
- SSR在connection后按请求执行开关与真实profile，不吞notFound/redirect；前端依现有品牌变量、原生控件和集中独立文案，无来源业务字段/账号数据。React lazy state使用freshSamples，每次复制对象，重置不复用被改动实例（`lab.tsx:7`、`data.ts:3`）。
- 没有新增示例业务API、迁移/表、模拟认证入口或样例持久化。新Python矩阵仅测试宿主调用Docker，正常Shell包装不增加Python依赖。无无关认证/审计改造。

结构按codebase-memory search→trace→snippet探索，coverage覆盖全部21变更与session/guard/auth-route/store/config依赖，均metadata_match、无报告缺口；仍以源码和行为为结论，索引为best-effort。Context7核对Next connection/notFound/redirect、React lazy initializer；Compose语义与前票同日官方核对一致。

## Spec与实际权限

- 开关false/defaultPROD时先notFound，不请求认证或呈现样例；启用时profile(true)调用既有/api/protected、no-store持久Cookie，由后端最新状态/撤销/版本/application:read决定访问，UI或地址不授权限（`page.tsx:6`、`:7`）。SessionGuard保持既有心跳/失效/活动合同。
- 本次真实Web专项：匿名307持续login_required；普通有角色人员与Agent200且含样例，直接accounts/audit API均403；零角色/Pending307回account、protected403、无入口；CLI停用后account_disabled、退出后session_revoked。管理员实际管理与审计API正常，SQL没有example表。账号页链接仅在active且有application:read、公共开关启用时显示。
- 样例sample-a/b/c和名称为合成内容，不来自业务或人员SQL；名称提交、标准/紧凑布局、重置仅useState，本页没有业务fetch、URL/浏览器存储写入。必填/80字符原生约束与空白不应用有明确实现；“应用到示例”不冒充正式保存。既有认证activity请求仍发生，不能误称样例业务写入。
- 元素默认来自已校验presentation.elements；当前只展示分页/通知默认，后续必填字段/稳定ID/数据操作/可选扩展分层合同与T11–T20范围清楚，不固化项目业务范围模型。
- 生产显式示例true仅影响Web入口，不改变API Agent开关或角色；代码继续调用正常受保护API。开发t10-browser-prod.json实际记录Agent旧会话agent_login_denied、普通人员显式开启后可用；本次未另行重跑该浏览器生产阶段，权限结论结合源代码、独立DEV允许/拒绝测试及该证据。

## 本次独立执行与开发证据区分

仅复用现成镜像、独立0008 auth-database/password-api/password-web，原0004不迁移重启。没有新建SQL对象变更；实际认证/账号/会话/审计使用已有正式后端。

| 本次独立命令 | 结果/证据 |
| --- | --- |
| checks以明确独立DATABASE_URL执行migrate | 空tmpfs测试库schemaVersion0008/applied8；工具实际输出 |
| `docker compose run --rm --no-deps -e TEST_WEB_URL=http://password-web:3000 checks node --test tests/examples.test.mjs` | 5/5，fail/cancelled/skipped均0；t10-independent-web.log |
| `docker compose run --rm --no-deps checks npm run typecheck` | API/Web退出0；t10-independent-typecheck.log |
| `python3 test-results/t10-review-config.py`（原examples-config脚本仅改自有容器/证据名） | 10组真实Compose/Web/CLI全部通过；t10-independent-config.log、config-matrix.json |

10组涵盖unset/DEV/UAT/PROD、PROD+true/DEV+false、开关与环境的显式空/非法。只输出两个公共配置键，完整config仅内存解析。开启匿名307、关闭404且响应无样例；非法Web真实非零退出/web_start_failed、CLIconfig-check非零JSON错误。所有一次性容器为本次独立名字并finally移除，不覆盖开发证据。

物理移除采用开发已完成的具体证据核对：t10-removal-source中examples目录与examples-copy.json确已不存在；t10-removal-build.log显示该源码副本生产Web成功构建到templux-t10-no-examples；t10-removal-http.log的1/1通过真实CLI创建/授权/正常密码登录，验证examples404、account无链接、protected/admin/audit及真实API200、审计含实际登录账号。对照单向依赖与删除合同没有剩余具体风险，本次没有盲目重复删除构建，也未把该1项记为审查者重跑。

开发t10-browser-memory.json另外记录键盘提交、重置/刷新恢复、只观察正常/auth/activity请求、项目变体20/10–20/7秒/2–1及390px不横溢；browser-agent/prod、桌面/窄屏截图和25份日志/JSON秘密扫描记录已核对。本次没有操作浏览器或重复完整152项。开发152/152证据保留，不写成独立完整suite执行。

已移除本次password服务/auth-database及10组自有配置容器；默认API/Web/database原镜像持续healthy，工作范围没有改实现/部署/.env/真人、push/关工单或操作Ego31。

## 局限

- T03真实组织登录与真人关联、生产TLS、Linux/WSL2/其它宿主仍另验；本次macOS Docker/Desktop与Linux容器的实际Web测试不代替全平台矩阵。
- 物理移除需要先false再删除/重建；运行开关不卸载已打包源码。后续正式共享控件仍须保持不反向依赖演示目录。
- 内存交互/项目变体/生产Agent旧会话与物理删除构建分别采用开发实际证据并核对源码；本次独立重点为真实Web准入、配置矩阵与类型检查，没有重新运行全浏览器或构建。
- SSR网络/成功body故障沿既有profile catch→null与Unavailable原路由重试，401/403导航保持源码合同；本次未再注入各类SSR断流/超时（前票与开发152完整回归已有证据）。

官方API核对：[Next connection](https://nextjs.org/docs/app/api-reference/functions/connection)、[notFound](https://nextjs.org/docs/app/api-reference/functions/not-found)、[React useState](https://react.dev/reference/react/useState)。
