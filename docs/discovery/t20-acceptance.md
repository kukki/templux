# T20 验收：应用导航、账号记忆与窄屏抽屉

Gitea #21 / #1故事61/63/64；基线 `baf0fbbd96c85615c28c7ceda066d0c2048f02a1`。合同[application-navigation.md](../specs/application-navigation.md)。保留既有63个本地提交，不推送/关闭工单。无新SQL迁移、业务API、用户主题/方向切换或生产认证fixture。T03真人飞书组织验收继续另列未完成。

## 源码、镜像与自动验证点

| 验证 | 结果/证据（test-results/） |
| --- | --- |
| 真实独立SQL/HTTP/CLI完整suite | `t20-full-isolated.log` **255/255，0fail/cancel/skip，58.6s**；`docker compose run --rm --no-deps -e TEST_API_URL=http://password-api:8080 -e TEST_WEB_URL=http://password-web:3000 checks npm test`，测试APP_PUBLIC_URL=localhost:31040符合既有套件Origin合同。**此源码点早于随后Tab首尾修正及偏好实例配置捕获/壳配置key修正**，不把255冒充最终全部源码执行 |
| 最终专项 | `t20-targeted-final60.log` **60/60**：`docker run --rm -v "$PWD/shared:/opt/templux/shared:ro" -v "$PWD/tests:/opt/templux/tests:ro" templux-checks node --test --test-concurrency=1 tests/navigation.test.mjs tests/presentation.test.mjs tests/editor.test.mjs tests/editor-deadline.test.mjs tests/overlays.test.mjs`；navigation11项含真实CLI配置、不改写、项目/账号/跨标签/禁用/失败/ending/快照 |
| 最终构建 | `docker compose build checks web api`，`t20-build-final.log`三镜像成功；源代码最终改动已包含上述Tab和配置快照修正，之后只改测试/文档 |
| 最终API/Web类型 | `docker run --rm -v "$PWD/shared:/opt/templux/shared:ro" templux-checks npm run typecheck`，`t20-typecheck-delivery.log`退出0 |
| 真实工具fixture类型 | `docker exec t20-components npm run typecheck`，`t20-fixture-typecheck.log`退出0；工具容器最终components/shared/fixture只读挂载 |
| 正式镜像无工具页 | `t20-production-fixture.log` `/t20-component` **404** |

`t20-final-images.log`记录最终checks/API/Web镜像ID，`t20-running-web-image.log`与最终Web匹配；`t20-final-source.log`和`t20-component-source.log`的模型/ApplicationShell/ProjectShell SHA256相同。新镜像仅用于工具服务，原运行API/Web未重启或部署新镜像。初始RED为`t20-red.log`缺模型；storage clear和配置对象捕获另有`t20-clear-red.log`、`t20-settings-red.log`正确断言失败，再最终60转绿。

## 正常身份与正式页面

全套完成后重建本轮自有人员user、管理员、Agent（关联本轮人员），真实CLI随机密码只在0700目录/0600文件交付，无明文输出。独立tmpfs Postgres使用既有schema0008；`t20-browser-setup.log`。正常密码页登录测试host127.0.0.1:31040，不操作真人/Ego31/原库。Agent保留DEV/PROD策略及正常后端权限；未为测试增加认证入口。

可复跑场景在`tests/scenarios/navigation-browser.mjs`，调用需预先正常登录的自有page或提供仅在驱动内读取受限文件的login回调：

- `navigationMemory(page,otherPage,origin)`：真实保护API200、普通账号管理API403、菜单仅account/protected/examples；图标切换、刷新恢复、真实同cookie标签页storage同步和无效值默认。`t20-identities-final.log`记录账号4自己的公开namespace，跨标签真实事件通过。
- `navigationIdentityCycle(page,login)`：管理员初始展开且有管理项，切换后与人员/Agent不串值；人员重登恢复图标；Agent真实profile.kind=agent且responsiblePersonId=本轮人员4，管理API403，初始按项目默认、自己的图标偏好重登恢复。当前退出reason=logged_out，全部退出reason=all_sessions_revoked；均真实按钮/后端，无模拟成功。
- `navigationDrawer`正式/examples：390px页面宽390、桌面栏display none，文字菜单完整；焦点进入关闭、9次Tab不离开、Escape返回菜单并释放overflow；dirty确认拒绝保留原值/抽屉，接受后实际到/protected再关闭；真实CDP触屏遮罩关闭。最终独立`t20-drawer-delivery.log`命令**退出0**，还验证dirty当前退出取消后API200/草稿保留、再完成导航拒绝/接受；对应最终生产镜像。较早`t20-drawer-saving-final.log`虽有drawer通过checkpoint但后续保存演示未完整通过，不将旧组合命令称为0退出；保存锁另由下述可控场景验证。
- 真实CLI撤权：dirty输入+抽屉打开→只将本轮人员roles改none→保护API401→online立即检查；`t20-revoke-final.log` reason=authorization_changed、drawer/fields0、overflow空、宿主Date约114ms。随后只为继续隔离测试恢复该账号user，未操作真人。

## 可控保存与兼容边界

`tests/fixtures/navigation-page.tsx`仅挂t20-components工具route（API端口1），直接消费实际ApplicationShell/EditNavigationProvider/EditSession，Promise由测试明确释放，不模拟认证或业务API响应。`controlledNavigationLock(page,url)`最终`t20-controlled-delivery.log`退出0：持续saving期间点导航仍原路径/抽屉，点当前退出**真实fetch调用计数0**；session-ending事件使drawer移除、overflow释放、编辑器不再busy。事件测试不是已验证身份的替代，真实401另由上述正式页/CLI完成。

`navigationStorageUnavailable`使用仅本轮页的CDP新文档注入，使Storage.getItem/setItem抛真实SecurityError/QuotaExceededError路径：读取拒绝按默认、写拒绝仍可内存切换、刷新按默认；finally移除注入并完整刷新，恢复原已存个人偏好。`t20-storage-final.log`为最终结果。此为受控API故障，不声称真实浏览器隐私设置/所有平台都验证。

配置/页面重启7组实际结果`t20-config-controls.json`、`t20-config-controls-delivery.log`：键盘Tab激活图标提示、其它projectKey默认、不允许切换时旧false被项目true覆盖/旧true被项目false覆盖、重新启用恢复自己缓存、坏值回默认、品牌及footer隐藏时账号/两退出仍在且窄屏可打开菜单。只写本轮测试配置，结束恢复共享默认并重启**测试**API/Web；不改现用presentation。

## 四主题×方向×视口真实截图

Ego72截图再次`CdpRequestTimeoutError`（t20-ego-screenshot.log）；依照任务要求使用已安装agent-browser自有命名会话`templux-t20-navigation` fallback，正常密码页登录本轮管理员（batch stdin输入，输出只记录步数/退出码）。未导出cookie、使用换票或模拟profile。独立Chromium截图成功，不能将Ego失败作为图片AC豁免。

`t20-matrix.py`通过独立配置文件切换并重启工具API/Web，沿用同一个真实有效持久会话。`t20-matrix.json` **8组/16张**，桌面1280×900、窄屏390×844；每组验证DOM宽度、profile账号5、方向、真实CSS背景、抽屉5项/滚动锁/关闭可达。深黑默认图标模式，其余文字展开；窄屏始终文字，无永久图标栏。截图路径：

| 主题 | 纵向桌面/窄屏 | 横向桌面/窄屏 |
| --- | --- | --- |
| light-blue | `t20-shots/light-blue-vertical-{desktop,narrow}.png` | `t20-shots/light-blue-horizontal-{desktop,narrow}.png` |
| dark-black | `t20-shots/dark-black-vertical-{desktop,narrow}.png` | `t20-shots/dark-black-horizontal-{desktop,narrow}.png` |
| dark-brown | `t20-shots/dark-brown-vertical-{desktop,narrow}.png` | `t20-shots/dark-brown-horizontal-{desktop,narrow}.png` |
| dark-yellow | `t20-shots/dark-yellow-vertical-{desktop,narrow}.png` | `t20-shots/dark-yellow-horizontal-{desktop,narrow}.png` |

四张`{theme}-review-sheet.png`为同一真实PNG缩略拼图（左起纵向桌面/窄屏、横向桌面/窄屏），由checks已安装sharp生成，已逐张view_image检查。16原图保持原始截图，非生成UI/AI图；各主题强调、当前项/图标栏、横向行、文字抽屉及退出可读，无发现裁切或页面横溢出。图片供人工审查，不建像素门禁；缩略图不替代原图。

## 失败尝试与限制

初次完整套件有3项使用默认原服务URL/schema0004导致预期0008失败；未修改原部署，改显式独立URL后255通过。测试配置目录初缺roles.json导致工具API拒启动，补公开角色文件后正常；空库仅应用既有0001–0008，无新迁移。原生dialog Tab末端曾聚焦body，实测RED记录t20-drawer-focus-red.log，增加显式首尾Tab后正式drawer通过。

Ego新标签需newPage，直接p2句柄未创建的尝试保留；高层自动滚动点击演示按钮被父区域拦截，后改实际scrollIntoView/两帧/elementFromPoint命中后真实mouse.click。4秒演示保存与工具交错不能提供稳定锁边界，另有退出双按钮选择器歧义，故改可控工具consumer，不把那些命令报成功。图标提示第一次programmatic focus不满足focus-visible，实际Tab测试通过；配置对照脚本括号错误修正后7组通过。保留日志，不以改期望掩盖产品错误。

未重复最终全255、物理触屏/真实软键盘/读屏/全浏览器；最终60与实际页面/截图对应最终镜像，初始255时间点分开。未承诺跨设备、所有浏览器无首帧几何变化或未接入history可取消；不新增权限/业务范围编辑。依照codebase-memory图查询及覆盖并直读相关源码（best effort），Context7核对Next onNavigate/usePathname、原生dialog/focus及storage事件。

公开证据与三份真实测试密码匹配扫描、原服务status、工具清理记录在`t20-secret-scan.json`、`t20-original-status.json`、`t20-cleanup.log`。交付前删除自有Ego72/agent-browser会话、组件容器、password/SSR/tmpfs测试服务和受限凭据目录；原三服务保持healthy/schema0004，未改.env/现用presentation/真人权限/飞书或发送通知。新镜像保留供独立审查。
