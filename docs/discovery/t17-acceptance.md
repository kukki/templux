# T17：图片预览、图库与失败备选验收

2026-10-15，Gitea#18/#1故事87–89；基线`3a749e9e847879c8017a3b1268678f14c23281c6`，保留51个旧本地提交。开发交付待独立审查，未push/关闭工单。[图片合同](../specs/image-preview.md)记录采用/安全/手势/资源与身份边界，[计划](t17-plan.md)记录实施步骤。

## 交付范围

- 通用`shared/image-preview`控制源校验、每图候选顺序/token、缓存/终态/取消、显式图库索引及fit/缩放/平移几何；React `image-preview`与native `image-loader`控制原生dialog/解码/指针/焦点，均不依赖examples。
- 默认单图等比fit、不放大小图；图库须enable+项目列表、上下张/位置/边界不循环，切图归零。每图备选仅本图顺序，全失败占位/禁预览，无默认重试或下一图替代。加载中、ready和失败分开；图片/源/设置改变关闭替换实例，旧结果不写新图。
- 可选中心锚点缩放1–4（项目上限1–8）、按钮/+/-/0、方向键、主鼠标/单触点有界拖动；resize恢复fit。无滚轮/捏合、复杂编辑或图片后端。遮罩合格点击、按钮、Escape关闭，点图/拖出不关闭，焦点圈定/恢复，session ending无条件清理。
- `elements.images`缺分支补false/4；显式非法/不完整拒绝，现用presentation未改。纯代码SVG与刻意损坏源位于public/examples，仅合成展示，无来源业务照片、业务API/SQL/外发。真实图片权限仍归项目服务端及正常会话；native img错误无法区分HTTP401，不能据资源失败退出身份，受保护加载适配器须用既有sessionFetch合同。

## 容器及源码点

宿主只运行Docker/浏览器工具/证据脚本；Node24/TypeScript/Next检查在容器。原部署0004不动，测试auth-database tmpfs schema0008，正常密码账号由真实CLI创建并授user，随机凭据仅私有0600文件。

```sh
docker compose build checks web
docker compose up -d --wait auth-database password-api password-web ssr-body-api ssr-body-web
docker compose run --rm --no-deps -e TEST_API_URL=http://password-api:8080 -e TEST_WEB_URL=http://password-web:3000 checks npm test
docker compose run --rm --no-deps checks node --test tests/image-preview.test.mjs tests/notifications.test.mjs tests/presentation.test.mjs tests/editor.test.mjs tests/editor-deadline.test.mjs
docker compose run --rm --no-deps checks npm run typecheck
```

本机ignored `test-results/t17-*`保留输出/脚本/JSON/截图。正常suite使用默认localhost Origin；正常浏览器前仅将自有API public URL切127.0.0.1隔离原localhost Cookie。

| 验证点 | 结果 |
| --- | --- |
| 控制器RED/GREEN | 实现前新测试缺模块失败`t17-controller-red.log`；初始9项GREEN`t17-controller-green.log`，随后加入真实CLI配置测试，共图片10项。 |
| 完整集成 | `t17-suite.log`：**209/209、失败/取消/跳过0**，约58秒，真实SQL/HTTP/CLI与既有认证/授权/会话/审计/例子门贯通。**此点早于触屏遮罩事件修正**，不声称最终全套重跑。 |
| 最终构建 | 触屏事件修正后`t17-complete-build.log` checks/web构建退出0，仅重建自有password-web。 |
| 最终专项/类型 | `t17-delivery-targeted.log`：**55/55、0失败/取消/跳过**；`t17-delivery-typecheck.log` API/Web0，实际fixture的`t17-delivery-fixture-typecheck.log` Web0。此后无正式代码改变。 |
| 源对应 | `t17-final-source.json`：7个控制器/loader/React/配置/示例/fixture关键文件容器与宿主逐字节匹配及SHA256；正常password-web Image ID与最终构建一致。另记录最终宿主浏览器场景SHA256。 |
| 生产隔离 | 最终Web `/t17-component`404、匿名`/api/protected`401（`t17-production-boundary.json`），测试路由/控制事件仅挂自有组件容器。 |

图片专项覆盖根路径/无凭据HTTPS安全协议、去空重复、alt/ID/显式列表校验，备选旧token/load/error、全部失败终态、缓存不重试、图库边界/迟到/取消、放大/中心平移clamp/resize归零、卸载/结束、旧配置缺省/显式invalid/真实config-check且不改文件。原通知16项及T14/T15状态、呈现回归一并通过。Postgres对象未修改，无新迁移。

## 实际React组件

Ego TaskSpace60、同一p1；仅自有t17-components挂载`tests/fixtures/image-preview-page.tsx`，加载适配器可控Promise，API内部指向端口1，不提供认证。场景`tests/scenarios/image-preview-browser.mjs`调用真正ImagePreview与native dialog，传输刻意忽略abort以验证代次。长alt含数百中文字，检查caption滚动区域与页面宽度。

最终`t17-components-last.json/log` **7组通过**：

1. 首源失败→本图备选；旧尝试结果不能跳过当前解码，ready前入口禁用，长alt有界。
2. 原生触控遮罩关闭，等待兼容事件结束后焦点返回；遮罩下探针按钮点击数0。
3. 切B挂起→C成功→B旧error晚到，C不变；缩放归1、末项禁用不循环。
4. 明确再选B从尚未完成候选恢复，B候选全失败保持B占位，不自动下一图/重试。
5. 源描述rev1仍挂起时再替换rev2，弹窗关闭，rev1成功晚到不能启用rev2；rev2成功后才可开。
6. 挂起时卸载，晚成功不留下DOM/模态。
7. 打开/加载中session-ending同步清除，再晚成功不能恢复旧预览。

fixture通过read-only挂载运行；修改fixture长alt后，开发服务器热缓存起初仍显示22字符旧alt，实查容器源已变而DOM未变，重启**自有组件容器**后再验证通过，不把旧DOM当长alt证据。正式代码无此热更新合同。

## 正常密码页面与触屏修正

最终`ego-browser nodejs < test-results/t17-browser-final.mjs`退出0，`t17-browser-delivery.log`、`t17-browser.json`：

| 行为 | 实测 |
| --- | --- |
| 原生源解码 | 缺失→损坏SVG→有效A后入口可用，实际显示/examples/image-a.svg；全失败与空源入口disabled，占位。不使用自定义fixture loader替代正式页面原生解码。 |
| 单图关闭 | 无图库/缩放工具；初始关闭按钮焦点；点图保持、Escape/按钮/鼠标遮罩关闭均回原按钮。 |
| 默认fit | A显示897×598、原始1200×800，比例1.5；stage约1239.6×600，页面1440无横溢出。 |
| 桌面zoom/pan | 键盘+及按钮至4×上限、放大禁用；真实鼠标pointer拖动得到x300/y150，均在图超出stage一半内，拖后仍打开。 |
| 图库/resize | 1/3上一张disabled，B/C切换并归scale1、pan0，3/3下一张disabled；Tab仍在模态内。390px后C fit约328.4×102.6，stage330.4×422，页面宽390。 |
| 真触控 | CDP touchStart/Move/End产生touch pointer；点图不关、触控按钮至1.5×，拖动x60/y0（不溢出轴拒平移），有界且页面390；触屏遮罩关闭返回按钮。 |
| 真实撤权 | 预览打开时CLI撤自有user至none，保护API200→401；online检查**112ms**重登，旧预览0，刷新仍authorization_changed。 |

首次正式页面揭示真实触屏关闭缺陷：pointerup关闭后，兼容mousedown使已恢复焦点再次落body，`t17-browser.log`/`t17-touch-close-red.json`记录事件链；新增版本化组件触控回归RED（`t17-touch-component-red.log`）。单独prevent pointerdown可保焦点，但底层探针仍收到1次click（`t17-touch-close-layer.json`）。最终保留按下/抬起与位移资格、取消遮罩down默认，在对应click取消默认/传播后才关闭；最终7组证明返回焦点且底层点击0，不用定时器补焦点/历史回滚。

已实际查看`t17-preview-desktop-zoom.png`、`t17-preview-narrow-fit.png`、`t17-preview-narrow-touch.png`：品牌一致、工具/关闭可达，长宽图等比，窄屏无横溢出。**这些布局截图来自触屏事件修正前的相同UI布局点**；最终行为轮在首个Page.captureScreenshot遇到CDP超时，页面仍可读取/操作。保留`t17-browser-final.log`故障记录，最终改用不含截图的相同行为脚本重跑全流程成功，未把截图超时称应用通过或伪造新截图。

## 清理及局限

自有TaskSpace60已finish({keep:[]})一次（`t17-browser-finish.log`），删除t17-components、password-api/password-web/SSR/auth-database测试容器及私有0600凭据目录；tmpfs测试身份销毁。公开56个证据文件实际测试密码匹配0（`t17-secret-scan.json`）。原api/database/web仍healthy，status ready/schema0004、login200（`t17-final-services.json`、`t17-original-status.json`）。未重启/迁移原部署，未改.env/现用presentation、Ego31、真人权限或发送飞书通知。

本机Chromium视口/触控协议不等于物理手机、所有软键盘/OS/浏览器、读屏或外部HTTPS图片矩阵。native Image只能判资源失败；业务图片HTTP身份/域许可/服务端访问仍由项目负责，不能从img error猜401。缓存只实例生命周期，abort不保证取消远端传输；不提供捏合/轮式缩放或业务照片编辑。最终未重复209完整suite或无关平台矩阵，验证点已分开。T03真实飞书组织人工验收继续另列未完成。

## 初审修复补充

F1/F2/F3的修前复现、最终专项/组件验证及平台边界见[修复验收](t17-fix-acceptance.md)。以上原实现证据保留其源码点，不代表修复后重跑全套。
