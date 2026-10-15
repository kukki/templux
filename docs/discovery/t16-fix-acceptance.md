# T16 F1：到期与断点收缩交错修复

2026-10-15；修复基线`5f0f28a58ecffd0918009d113ec4fe39824f844a`。独立初审[原报告](t16-review.md)完整保留，F1/P2待独立复核；本记录不改写初次194项验证历史。

## 复现与原因

已用实际checks容器独立复现：ABC可见、DE等待、容量2；单调时钟从0推进16000但不先tick，直接setLimit(1)。原update先advance再按旧上限fill，D/E在同一操作中被临时提升，随后E入suspended；E从未发布为visible，却获得已显示保护。再入FGH只省略F（1条），关闭D显示E。`test-results/t16-fix-before.json`与独立初审证据一致。

先加5个精确回归，原代码在15000/16000到期收缩及部分到期三项失败，另两项对照通过（`t16-fix-red.log`）。不改变期望，也不把内部瞬时fill重新解释为实际显示。

最小修正：内部update增加refillBefore选项，默认保留常规入队/关闭等先协调补位的既有规则；setLimit独立关闭前置补位，在一次状态发布内依次到期→应用新limit/仅移动仍存活的已发布尾部→按新limit补位。现有suspended仍优先恢复，暂停余量/清失效DOM暂停原因不变，无新公共API或架构。

## 修后证据与命令

最终正式代码仅`shared/notifications.mjs`两处顺序调整和一条说明；挂载最终源码到现有checks镜像及一次性开发组件容器。没有重建Web镜像或重复无关194/SQL矩阵。

```sh
docker compose run --rm --no-deps -v "$PWD/shared:/opt/templux/shared:ro" -v "$PWD/tests/notifications.test.mjs:/opt/templux/tests/notifications.test.mjs:ro" checks node --test tests/notifications.test.mjs tests/presentation.test.mjs tests/editor.test.mjs tests/editor-deadline.test.mjs
docker compose run --rm --no-deps -v "$PWD/shared/notifications.mjs:/opt/templux/shared/notifications.mjs:ro" checks npm run typecheck
```

| 验证点 | 结果 |
| --- | --- |
| 原场景修后 | `t16-fix-after.json`：D可见、E等待、无suspended；FGH后waiting G/H、omitted2；关D后G可见、H等待。复现脚本`t16-fix-reproduction.mjs`通过read-only mount运行，修前后输出同一场景。 |
| 最终专项 | `t16-fix-targeted.log`：**45/45、0失败/取消/跳过**（原40+新5）。通知本身16项。 |
| 新5项 | 15000及16000两种原组合，核对已发布快照/后续淘汰数/被丢ID/关闭后下一项；部分到期只保护存活C、focus余量保留/清原因、同键合并/恢复优先；已存在暂停区的到期扩展；14999未到期收缩保留B/C各1ms，后续入队/到期/关闭顺序保持。 |
| 类型 | `t16-fix-typecheck.log` API/Web退出0；实际挂fixture的`t16-fix-fixture-typecheck.log` Web退出0。 |
| 真实组件 | Ego58执行版本化`notificationClock(page)`，**8组全通过**（`t16-fix-components.json/log`）：hover/focus/内部移动/剩余、合并、常规溢出、同刻多到期、收缩展开及余量/焦点、键盘关闭补位、end后拒复用。没有仅测helper来替代DOM回归。 |
| 最终源对应 | `t16-fix-source.json`：最终控制器、未改React视图、fixture与容器逐字节一致及SHA256。结构search/trace/snippet及5路径coverage无报告缺口，best-effort不等于完整性证明；相关源码另直接读取。 |

组件运行使用旧checks镜像的依赖与未变组件，**新控制器明确read-only挂载**，所以这些结果对应最终修复源码，不声称旧镜像本身已经包含补丁。脚本在ignored test-results，版本化回归在tests/notifications.test.mjs及原组件场景。没有新框架API用法，沿用已核对官方React/浏览器订阅及媒体事件语义。

## 清理与范围

自有Ego58已finish({keep:[]})一次，t16-fix-components删除；`t16-fix-browser-finish.log`/`t16-fix-cleanup.log`。本轮不建数据库或凭据、无SQL变更；仅原api/database/web仍健康，原status ready/schema0004、login200（`t16-fix-original-status.json`、`t16-fix-final-services.json`）。未重启/迁移原部署，未改.env/presentation、Ego31、真人/飞书通知，无push/关票。

精确交错采用容器可控单调时间；真实DOM为Chromium，不将8组前台组件回归声称为物理手机/后台精确计时或新正常密码/SQL全矩阵。后者沿用初始开发证据，本次不重复。现有后台协调和T03真实飞书人工待办限制保持。
