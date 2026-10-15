# T15：按行保存与编辑弹窗验收

日期2026-10-15；工单#16、父规格#1故事81–82。实现基线`efb538ccaaf220083827917f30bac8be9d1e3b76`，既有45个本地提交保留。实施计划见[t15-plan](t15-plan.md)，采用合同见[行与弹窗编辑](../specs/row-and-dialog-editing.md)。本记录为开发验证，待独立审查；没有推送或关闭工单。

## 交付范围

- `EditableTable`默认复用只读表；显式editing配置才出现操作列。本票采用表下当前行编辑区，标题显示稳定记录ID，同表单行编辑；源版本变化/删除/加载时保留草稿、拒绝旧提交，不覆盖新数据。项目必须提供稳定ID、版本和最终服务端校验。
- `EditSession`共用编辑与验证状态，`EditDialog`增加原生模态语义/初始与返回焦点、首尾Tab循环、Escape关闭判定及窄屏滚动。关闭/取消只处理当前源；普通表单还原也改为局部requestDiscard，不丢其它行草稿。T14消费者取消、同页hash及最新错误合同保持。
- 默认30秒截止，等待中UI和控制器拒绝改值/主动关闭/取消/重复提交；超时释放等待并保留未确认回执，不自动重试。每次明确保存生成128位随机操作ID；核验只接受当前回执。取消/卸载/新代次后晚返回不更新父记录。abort不代表远端回滚，项目须在编辑器外保存待核验操作，不能把本地回执当幂等、授权或持久台账。
- `/examples`新增三个合成内存记录，正常/字段/表单/403/网络/等待/超时情景及显式核验。没有业务API、SQL对象或生产模拟认证入口。演示6秒等待；超时情景1.5秒解除等待，4.5秒可核验结果。

## 命令与最终源码点

容器Node24；Compose隔离auth-database schema0008、password-api/password-web、SSR故障服务，数据库为测试tmpfs。真实浏览器使用正常CLI创建的自有人员账号、正常密码登录，初始凭据仅0600私有文件。未操作真人权限。

```sh
docker compose build checks web
docker compose up -d --wait auth-database password-api password-web ssr-body-api ssr-body-web
docker compose run --rm --no-deps -e TEST_API_URL=http://password-api:8080 -e TEST_WEB_URL=http://password-web:3000 checks npm test
docker compose run --rm --no-deps checks node --test tests/editor-deadline.test.mjs tests/editor.test.mjs tests/search.test.mjs tests/multiselect.test.mjs tests/list-state.test.mjs tests/presentation.test.mjs
docker compose run --rm --no-deps checks npm run typecheck
```

本机ignored `test-results/`保留命令输出、脚本、JSON与截图；源码内提交可复用的`tests/editor-deadline.test.mjs`、`tests/fixtures/editing-page.tsx`和`tests/scenarios/editing-browser.mjs`。

| 验证点 | 结果及证据 |
| --- | --- |
| 集成完整suite | `t15-suite.log`：181/181通过、0失败/跳过，含真实SQL/HTTP/CLI及既有认证授权生命周期。**该点早于取消回执、非安全上下文crypto、焦点/局部还原的最后修正**，不能称最终全套。 |
| 最终镜像 | 最后局部还原/记录ID标题之后`docker compose build checks web`退出0，`t15-delivery-build.log`；只重建自有password-web。 |
| 最终专项与类型 | `t15-delivery-targeted.log`：43/43、0失败/跳过；`t15-delivery-typecheck.log`：API/Web类型均0。此后仅文档变动。 |
| 最终真实组件 | `t15-final-components.json`：局部普通表单还原保留Inline draft；6个受控弹窗场景覆盖校验焦点、等待/关闭/Escape/遮罩/重复提交只调用1次、成功返回焦点、dirty保留/放弃、目标改变保留草稿且不提交旧结果、卸载后无晚提交。 |
| 最终T14回归 | `t15-t14-regression.json`：原11状态、hash4种、最新Required错误反馈、旧边界7种、消费者事件顺序7种通过；取消消费者0确认/保留草稿，真正离开一次确认。 |
| fixture类型/源码对应 | `t15-final-fixture-typecheck.log`退出0；`t15-final-source.json`记录editor/navigation/session/table/form-demo五文件SHA256及容器与宿主逐字节一致。fixture仅挂载自有t15-components容器，未添加正式路由。 |
| 最终正常密码页面 | `ego-browser nodejs < test-results/t15-delivery-browser.mjs`退出0，`t15-delivery-browser.json/log`：普通表单还原不动Row retained、标题EDIT-101、一次提交校验焦点、真实内存保存显示Final accepted；等待busy=true时正常CLI撤权，保护请求200→401，online检查104ms回登录，刷新仍authorization_changed。 |

## 浏览器具体行为

Ego TaskSpace54只用于本票，使用同一p1；脚本位于ignored `test-results/`，须新建自己的隔离身份/空间重跑，不能复用已finish的54或真人31。

| 场景 | 实测 |
| --- | --- |
| 行编辑8项 | `t15-rows.json`、`t15-rows-stable-feedback.log`：默认无编辑按钮，显式启用、单行进入、取消保留/放弃不影响其它表单、首次无效保存正确聚焦且0调用；成功只改本行；fields/form/403/network保留输入和页面；外部刷新保留草稿/拒旧写。 |
| 弹窗11项 | `t15-modals.json`、`t15-modals-ready.log`：进入首字段、首尾Tab、关闭后返回触发器；遮罩不关闭、Escape及dirty确认；字段错误焦点、正常成功；超时未确认、早核验unknown、晚结果不假saved/不重试、明确核验一次更新；6秒等待期间按钮禁用、事件不能关闭/重复保存，结果后解锁。 |
| 响应式 | `t15-responsive.json`：390px页面宽390，表容器304/content960、横滚656且5列保留；弹窗左右19/371不出视口。`t15-revoke.json`：390×480弹窗上下16/464，内容497/client446，键盘至取消滚动33，Tab返回关闭。 |
| 最终截图 | 已实际查看`t15-final-dialog-desktop.png`（1440×1000）、`t15-final-dialog-narrow.png`（390×844），错误聚焦/品牌/标题ID/窄屏无横溢出；亦查看`t15-dialog-short.png`，内容可滚动。 |
| 强制失效 | 首次`t15-revoke.json`和最终`t15-delivery-browser.json`均在dirty且saving时CLI撤权、200→401、104ms重登；无确认阻挡，原因刷新保持。第一次对应先前焦点完成点；最终脚本对应最终镜像。 |

行/弹窗完整浏览器矩阵在最后“普通表单局部还原、标题带ID”之前完成；这两项随后由最终真实组件与最终正常密码页面单独覆盖，不把旧矩阵冒充最后全量重跑。

## 发现与修正的RED/GREEN

- `t15-editor-red.log`验证原控制器缺少截止/回执/锁；新增专项GREEN。最初RED缺截止而挂起，停止自有一次性容器后用`--test-timeout=1000`有界复现，不触及常驻服务。
- `t15-cancel-red.log`发现强制cancel仍可核验旧回执，修正为cancel使回执无效；`t15-crypto-red.log`验证只提供getRandomValues的浏览器上下文，改用其生成操作ID，避免引入randomUUID安全上下文要求。
- `t15-first-click-red.json`真实pointerdown在Save，blur插入错误使按钮下移约29px，pointerup落FORM，首次点击没有submit。局部保留错误反馈空间后，`t15-responsive.json`原生submit=1且焦点editName；不是仅用脚本直接调用submit。
- 原生模态末项Tab曾到浏览器界面，新增局部首尾边界处理；真实键盘正反向与保存中焦点边界通过。
- `t15-scope-red.json`普通表单“还原编辑”经全局requestLeave错误还原行草稿；改局部requestDiscard，最终组件/正常密码页均证明其它草稿保留。

## 清理、安全和局限

自有TaskSpace54已`finish({keep:[]})`一次，`t15-browser-finish.log`。已删除t15-components与自有password-api/password-web/SSR服务/auth-database容器（tmpfs测试账号随库销毁），删除`t15-private`凭据目录；`t15-secret-scan.json`：79个公开证据文件匹配实际测试密码0次。最后仅原api/database/web健康运行，`t15-final-services.json`；原`http://localhost:31000/api/status`仍ready/schema0004、login200，`t15-original-status.json`。没有修改.env、正式presentation、原库/真人/Ego31或发送通知。

浏览器为本机Chromium加视口/触屏仿真，不代表真实手机软键盘、所有浏览器/操作系统或原生beforeunload一致；确认取舍部分使用受控window.confirm，原生提示平台限制沿T14。保存为内存消费者而非真实业务写API，真实项目必须实现授权/服务端校验/幂等或核验台账。第三方传输若不支持abort仍可能完成，组件只保证不接受晚结果。未作跨平台TLS、后台标签定时精度或生产部署升级验收。T03真实飞书组织人工验收继续单列未完成，本票没有替代或关闭该项。
