# T14 普通表单与未保存编辑验收

基线 `035550be473c778500832deace9d9f3112371efe`。本地实现，尚待TL安排独立审查；不push/关闭工单。T03真实组织人工验收继续另列未完成。

## 范围及实现

读取 Gitea Swython/Templux #15/#1、web-elements表单规则、ADR0012/0020与session-lifecycle合同。实现shared/editor控制器、React useEditor/FormField、EditNavigationProvider/EditLink/requestLeave；受保护examples提供纯页面内存表单。无业务API、SQL表/迁移、自动保存、模拟认证或T15/T19完整能力。

完整公开合同见 [forms-and-unsaved-edits.md](../specs/forms-and-unsaved-edits.md)，包括规范化/基线/重置、快照保存、新输入/并发/失败/卸载、HTTP消费者分类和路由整合责任。现有搜索内嵌名称、多选/分页状态不变；未新增强制呈现键，使用既有品牌变量与集中copy。

## 命令与最终源码点

所有正式运行使用Node24 Linux容器。初始RED在既有宿主Node25执行（未安装宿主工具），因editor模块尚不存在失败，`test-results/t14-editor-red.log`；初轮6项GREEN仅辅助，本节容器结果为正式证据。

```sh
docker compose build checks web
docker compose up -d --wait auth-database password-api password-web ssr-body-api ssr-body-web
docker compose run --rm --no-deps -e TEST_API_URL=http://password-api:8080 -e TEST_WEB_URL=http://password-web:3000 checks npm test
docker compose run --rm --no-deps checks npm run typecheck
```

`test-results/t14-build.log`构建0；`t14-suite.log` **172/172、0失败/跳过**（约60秒），包括真实SQL认证/审计/会话/管理员/密码/代理限制、SSR和受保护示例；`t14-typecheck.log`0。工具库实际最新0008（`t14-isolated-schema.log`），原部署0004未升级。

上述完整suite后，在实际DOM事件回归发现空download属性误提示（`t14-download-red.json`为1，预期0），最小改为hasAttribute，并识别同窗_top/_parent目标。**最终源码**再次 `docker compose build checks web`（`t14-final-build.log`0），只重建/重启自有password-web；下列正式最终检查通过：

```sh
docker compose run --rm --no-deps checks node --test tests/editor.test.mjs tests/search.test.mjs tests/multiselect.test.mjs tests/list-state.test.mjs tests/presentation.test.mjs
docker compose run --rm --no-deps checks npm run typecheck
```

`t14-final-targeted.log` **32/32**、`t14-final-typecheck.log`0；最终导航过滤/撤权实测如下。172项完整结果对应download边界修正前，未冒充最终过滤器全suite；该修正不涉及SQL/认证/列表逻辑，未重复无关昂贵矩阵。

## 实际组件与浏览器证据

浏览器Ego TaskSpace48，普通人员随机密码由正常CLI创建、授user并正常登录；文件0600，不打印密码，不授真实人员权限。`t14-provision.py`/`t14-provision.log`、`t14-browser-{create,grant}.log`。测试脚本在ignored test-results，可 `ego-browser nodejs < 对应.mjs`；重跑须创建自己的空间与隔离凭据，不复用已finish的48或真人31。

| 验证 | 观察结果及证据 |
| --- | --- |
| 真实受控React组件 | `tests/fixtures/editor-page.tsx`只挂载到自有t14-components容器，调用真实useEditor/FormField/导航组件；`tests/scenarios/editor-browser.mjs`11个状态点，`t14-components.json`。首次输入空无错、blur显示Required、submit全部且save calls0、改正清错、规范化还原clean。 |
| 保存并发/晚返回 | 受控Promise保存1次，等待中输入Gamma，返回Beta后仍Gamma/dirty且不报saved；字段/表单返回正确；reset后旧返回不saved；卸载重挂回Alpha且save calls为空。控制器6项容器测试进一步验证重复submit、transport忽略abort、失败不清dirty、不附旧字段错误。 |
| 真实正常表单 | `t14-production-cases-final.log`/`t14-production-cases.json`17项：blur附近错误、修改复查、成功推进基线、fields/form/403/network失败留输入留页面；延迟保存Snapshot时输入Newer，结果仍Newer/dirty，确认预览为Snapshot。规范化回Snapshot则clean。 |
| 保留/放弃 | 同一JSON记录重置取消留Keep me、EditLink/命令式router取消留编辑、router确认后到account；重进初始内存clean。成功保存后EditLink直接离开无提示。普通服务端锚点取消及重置放弃、纯搜索后普通锚点不提示在navigation脚本实际执行；初轮该脚本后续历史工具断言失败，不能当整轮通过。 |
| back/forward整合 | `t14-controlled-navigation-final3.log`/`t14-controlled-navigation.json`4项：真实组件的requestLeave包装router.back/forward，取消保留，确认到实际历史login/account目标。这里用受控window.confirm返回值验证历史动作/编辑状态，不冒充原生确认框全平台矩阵；生产Link/router的真实确认框另有上列证据。 |
| 最终链接边界 | 最终Web `t14-link-boundaries.json`：实际provider事件，空download0、_blank0、_top1、普通离开1、hash0；测试用受控confirm计数并在目标阻止默认导航，不触发真实下载/新窗口。 |
| 原生离开事件 | `t14-beforeunload.json`：真实刷新触发trusted/cancelable、preventDefault=true、用户激活=true，但当前Ego/Chromium仍直接刷新，没有原生框事件。只声称已注册取消请求，**不声称原生弹框显示通过**。clean重置后synthetic beforeunload不被取消，监听已释放。 |
| 真正撤权优先 | 最终Web `t14-final-navigation-and-revoke.log`/`t14-revoke.json`：真实protected200、表单dirty=true，正常管理CLI仅将本票隔离身份roles none，online触发真实检查，**104ms**直接login?reason=authorization_changed，无未保存框阻挡；随后protected401、刷新仍保留原因。`t14-browser-revoke.log`。 |
| 响应式/键盘 | 390×844，document.scrollWidth=390；Tab从备注到保存情景，名称上方持续可见、焦点清晰。1440桌面/390窄屏截图`t14-desktop.png`/`t14-narrow.png`已实际查看，无字段裁切/页面横溢出。 |
| 非生产fixture | 最终生产Web `/t14-component`实际404。没有将tests/fixtures挂载带入应用源码路由。完整suite含匿名/Pending/零角色拒绝、有角色人员/Agent真实例子权限，管理API仍403。 |

## 故障与平台边界

保留失败工具日志：一轮原生reload错误预期“取消后留Keep me”失败，后通过事件诊断确认平台未显示原生框；一次未滚到重置按钮点击超时；历史测试过早在原生confirm打开时读取DOM导致超时，关闭自有p2后用受控确认边界重测；另两次错误假定router目标必为login/账号页必含examples链接（该dev容器环境默认PROD关闭examples），改为观察真实account及protected链接后4项通过。没有为这些工具问题改写历史、认证或生产后门。

同文档工具栏back/forward未接入不保证拦截，不能以popstate事后回滚补救；消费者采用文档编辑入口或受保护的显式历史按钮。原生beforeunload不保证显示、文案不可定制、移动端杀进程不可靠；不声称Firefox/Safari/手机OS全矩阵。这里不是故意吞掉导航：站内明确用户确认和强制401优先各有实际证据。

Context7已读取React useSyncExternalStore缓存快照/清理、Next Link onNavigate/useRouter、MDN beforeunload及Navigation API限制；一次追加MDN遍历cancelable查询传输失败，未据该失败引入实验导航拦截。codebase-memory先status/search/trace/snippet再覆盖检查；依赖路径未记录缺口/元数据匹配，仍按best-effort说明，不作穷尽结构声明。

## 清理

完成前关闭自有浏览器48并删除自有工具容器/私密凭据；仅保留原api/database/web，最终状态及扫描记录见`t14-final-services.json`、`t14-original-status.json`、`t14-secret-scan.json`。原0004、.env、原presentation、Ego31/真人权限及通知均未动。无推送/关闭工单。
