# T18 完整值复制与本地反馈验收

2026-10-15，Gitea#19/#1故事90；基线`40df86d904b746f0ea8c5d15c7a6d878a4185992`，保留57个旧本地提交。交付待独立审查，未push/关闭工单。[实施计划](t18-plan.md)、[采用合同](../specs/full-value-copy.md)。

## 交付与验证点

共享实例反馈控制器、原生Clipboard writer、React按钮及局部live状态，受保护/examples纯合成短/长/空/明确拒绝演示。默认1500ms、空值disable，可配hide；完整字符串不trim、不从DOM截断猜值。无业务API/SQL/消息外发、无新增依赖；未接入凭据交付UI。实际presentation、.env及原0004未改。

RED：`test-results/t18-unit-red.log`先因copy模块不存在失败；随后11项GREEN。最终12项加CLI配置入口，`t18-targeted-latest.log`与其它共享回归合计**54/54**。覆盖完整/空白/长尾/显式数字字符串与拒绝隐式类型、同步用户激活写、pending去重、1500/2500ms计时、旧timer/晚成功失败、清理/end、脱敏snapshot及legacy/invalid/合法配置无写入。

```sh
docker compose build checks web
docker compose up -d --wait auth-database password-api password-web ssr-body-api ssr-body-web
docker compose run --rm --no-deps -e TEST_API_URL=http://password-api:8080 -e TEST_WEB_URL=http://password-web:3000 checks npm test
docker compose run --rm --no-deps checks npm run typecheck
docker compose run --rm --no-deps -v "$PWD/tests/copy.test.mjs:/opt/templux/tests/copy.test.mjs:ro" checks node --test tests/copy.test.mjs tests/presentation.test.mjs tests/image-preview.test.mjs tests/notifications.test.mjs
docker exec t18-components npm run typecheck --workspace @templux/web
```

| 最终执行 | 实际结果与test-results证据 |
| --- | --- |
| checks/Web production构建 | 退出0，t18-build-retry.log；前次Docker Hub metadata超时保留t18-build-final.log，重试成功不是忽略编译错误 |
| 完整独立SQL/HTTP/CLI回归 | **225/225**，失败/跳过/取消0，t18-full-final.log；API服务为现有认证镜像，Web/checks使用本票新镜像 |
| API/Web类型与tool fixture类型 | 退出0，t18-typecheck.log、t18-fixture-typecheck.log |
| 最终共享专项 | 54/54，t18-targeted-latest.log；完整回归后只补强2500ms覆盖值的测试断言，此专项已包含该最终测试文件；产品源码未变 |
| 正式镜像fixture路径 | /t18-component为404，t18-production-fixture-status.log；fixture仅自有dev容器路由挂载 |

`elements.copy`whole branch缺省兼容schema1，显式null/空/不完整/错误enum/range/unknown拒绝；CLI config-check实际退出码及文件不变已测。用户当前呈现文件保持原内容，不因新增默认分支被写回。

## 实际组件

自有Ego TaskSpace66/p1与`t18-components`（127.0.0.1:31058/t18-component），公开write适配器控制结果，不构造认证。最终容器基于本票新checks镜像，fixture只读挂载，`t18-component-mounts.log`/`t18-source-hashes.log`记录宿主与容器控制器/view/writer/fixture字节一致。

版本化`tests/scenarios/copy-browser.mjs::controlledCopy(page,url)`最终8组通过（t18-components-keyboard-final.log）：

1. pending点击禁用/无重复写，完成才copied，本地1540.4ms恢复；form submit与父row click均0。
2. 原生键盘Enter触发、NotAllowedError就近与live反馈，异常私有文本不暴露。
3. Space触发、unsupported与generic failure可重试，无假成功。
4. 目标变化后旧resolve不能标记新目标，明确新复制才成功。
5. 目标变化后旧reject不能污染新目标，明确新复制可成功。
6. pending卸载/晚完成/再次挂载为idle，不复活旧反馈。
7. 空值disabled→hide，无可用复制入口。
8. session-ending移除全部复制按钮/反馈，晚完成不能恢复。

纯逻辑测试使用可控调度器验证精确timer代次；浏览器计时为真实观察值，不承诺后台精度。受控writer仅表示平台边界的可观察替代；不把它当原生剪贴板成功证明。

## 正常密码与原生剪贴板

隔离tmpfs SQL schema0008，使用真实CLI创建自有随机密码人员并授user，经正常密码页进入/examples（无fixture认证）。凭据只在自有0700目录/0600文件，未输出。初始化观察脚本最后误查不存在的templux.schema_migrations导致非零，保留t18-setup.log；之前create-person/authorize已提交，正常浏览器登录及/api/status的schema0008实际证明链路，不将该脚本误报全程成功。

`t18-native-verified.log`命令退出0（驱动t18-native-browser.mjs）；可复跑逻辑另收录`tests/scenarios/copy-native-browser.mjs::nativeCopy(page,origin)`，要求先正常登录到自有测试origin。

| 真实行为 | 结果 |
| --- | --- |
| 完整长值 | 原生writeText后readText逐字相等，**438字符**且完整末尾-END；仅对应按钮copied，1542.7ms恢复 |
| 原生拒绝 | 仅测试origin临时CDP clipboard-write denied，实际API拒绝后本地denied，恢复后重试短值实际readback相等 |
| 不支持 | 独立受控隐藏当前页navigator.clipboard后默认writer走unsupported，恢复属性；这是API缺失模拟，不声称真实非安全域/全浏览器验证 |
| 窄屏 | viewport/page均390，长值client306/content3966，视觉ellipsis不影响此前完整复制；空值disabled与hide均正确 |
| 环境恢复 | 测试前保存在页面内存的ClipboardItems请求原生写回（原无格式项按空文本恢复），未打印原内容；read权限prompt→granted→prompt、write granted→denied/granted→granted，最终query确认原state；focusEmulated=false |
| 真实撤权 | CLI将自有user降为none，online检查后登录reason=authorization_changed，旧复制控件0，t18-real-session-ending.log；该日志跨文档performance计时为负，**不用于退出延迟结论** |

生产复制不查询权限/不读已有剪贴板；临时read/write权限覆盖仅自有localhost:31040测试origin，未全局reset或更改个人持久权限。ClipboardItems恢复是平台API确认，不保证OS自定义格式/应用私有元数据逐字节还原；空剪贴板恢复为空文本。首轮未聚焦拒绝、空格式ClipboardItem备份边界及heading不可点击的工具尝试保留日志；均发生在修改剪贴板前并走权限finally恢复。最终通过轮使用实际焦点，没有模拟复制成功。

Page.captureScreenshot在完成原生行为后超时（t18-native-complete.log），finally仍执行恢复；随后不含截图的相同行为驱动完整重跑成功。不提供或冒称本票截图通过；窄屏以实际DOM宽度/操作验证，像素审查仍是局限。

## 安全、源码与清理边界

共享反馈snapshot/DOM消息不含目标/异常；演示文本均合成，不使用真人/Agent密码。公开t18证据与自有实际测试密码匹配扫描0，t18-secret-scan.json。未改变人员单次no-store下载、CLI/Agent0600及拒覆盖规则。

本票不新增迁移。原schema0004/API/Web未重启或迁移，原status仍ready/connected/schema0004（t18-original-status.json）；T03真实飞书组织人工验收继续另列未完成。清理自有Ego66、t18-components、password/SSR/auth-database测试服务和私有凭据目录，保留新构建镜像供审查；没有自动部署给原容器。

Chromium/localhost不等于所有浏览器、OS、物理触屏或读屏；成功需安全上下文、权限/焦点/用户激活，原生写已发出不能保证撤回。未重复物理移除构建/全部项目变体截图；共享组件无examples反向依赖，既有移除合同保持。
