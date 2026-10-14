# T05 独立 Standards / Spec 审查

日期：2026-10-15（Asia/Hong_Kong）。范围：`f169a27f2d9205988121662c7c1b75e11c25fb01...677430fd727fa3b2bf69c931e4c5eb99d7a12aab`，全部22个变更文件，审查时HEAD一致。

按Team治理及TL指示，由同一独立于实现者的审查者依次双轴，未创建新成员。已读取Gitea #6/#1、现行认证与会话规范、ADR0020/0021/0023、开发计划/合同与验收；使用code-review、codebase-memory、Context7、Postgres best practices及verification-before-completion流程。不改实现、部署配置、.env或真人权限，不操作Ego31，不推送或关闭工单。

## Standards

**0项编码规范发现。**

会话读取在同一pg客户端短事务中获取共享授权锁，角色、状态、版本、撤销与活动均使用该客户端；管理写操作仍为同一独占锁。没有锁内外部HTTP调用，也没有用pool.query拼事务。没有新迁移或固定项目范围表，项目接入接口、退出服务与前端控制器职责可分别定位。运行时期限和Origin检查保留；类型与工具已检查的事项不重复人工报告。未发现值得报告的Fowler基线异味。

此轴仅评价指定差异的编码规范，业务恢复行为问题另列Spec。

## Spec

**1项P2需修复；建议修复后再验收。**

### F1 / P2：SSR成功响应的body中断未进入原路由重试

- 位置：`apps/web/app/components/session.ts:15`（第8–12行仅catch fetch等待，第15行成功JSON读取在catch外）。
- 依据：#6要求网络故障不误退出；本票合同进一步明确“服务器渲染瞬时失败在原路由显示重试，不把连接故障跳到登录页”。当前account/protected/admin页在profile返回null时渲染Unavailable及同路由重试。
- 触发：内部API已发送200状态及JSON响应头，随后网络在body读取阶段断开或超时。fetch已成功返回Response，后续response.json仍会因流中断拒绝，当前函数没有捕获。
- 实际影响：/account与/protected返回HTTP500，没有项目“重试”或“连接暂不可用”提示，无法走已实现的Unavailable恢复分支。没有观察到误注销Cookie或身份误失效；问题是恢复合同部分缺失，不是认证绕过。

本轮使用已有生产Web镜像、独立命名的一次性故障HTTP服务，未改应用实现或默认API。故障脚本 `test-results/t05-review-body-server.mjs` 在8080返回200 application/json、flushHeaders、写入未完成的account JSON，100ms后destroy响应连接。重现入口：

```sh
docker compose run --rm --no-deps --name templux-t05-review-body \
  -v /Users/jkoo/git/Templux/test-results/t05-review-body-server.mjs:/opt/templux/tests/review-body-server.mjs:ro \
  checks node tests/review-body-server.mjs
docker compose run --rm --no-deps --name templux-t05-review-web \
  -e API_INTERNAL_URL=http://templux-t05-review-body:8080 \
  -p 127.0.0.1:31050:3000 web
```

从该临时Web真实HTTP读取/account、/protected：两者均500，HTML分别保存在 `test-results/t05-review-body-account.html`、`t05-review-body-protected.html`；均不含“重试”或“连接暂不可用”。实际Next容器输出（本轮工具日志观察）：

```text
TypeError: terminated
cause: SocketError: other side closed
code: UND_ERR_SOCKET
```

这是实际Next SSR和网络断流，不是仅用mock Response推断。故障服务只用作请求失败注入，没有成功登录/授权fixture。自有Web及故障容器已删除，默认服务未重启。

建议：成功响应body消费/JSON解析失败也返回null，继续渲染Unavailable。保持已知明确401与正常403的现有导航分支，避免扩大catch时吞掉Next redirect控制流。增加headers成功后body断流/读取超时的实际SSR回归，验证account/protected/admin同路由重试、Cookie不变且无登录误跳；保留明确401失效导航回归。

### 其它检查结果

- `auth-store.ts:99`共享事务锁与管理独占锁一致，同客户端校验状态/撤销/版本/角色；`loadSession`使用clock_timestamp比较期限，touch使用GREATEST单调推进。已通过检查的在途请求不保证撤销效果，合同没有声称能回收已执行操作。
- heartbeat/session不touch；activity要求精确同源、有效会话后touch；过期/撤销无法复活。人员与Agent独立期限沿用。当前交互业务API的touch=true是已记录选择，未来后台轮询须显式touch=false。
- 当前退出只撤销对应token，全部退出在独占事务中核验当前会话并撤销该账号所有现存未撤销会话；审计和撤销同提交。多设备、其它账号及后续明确新登录边界有真实SQL/HTTP覆盖；撤销持久化、重启不可复活。
- `invalidateAccountAccess`传同一事务客户端，独占锁下提升版本并写scope审计，与项目自己范围更新同提交/回滚。调用者必须先做项目权限检查、使用现有transaction及锁，不能在自动提交或pool上下文误用；没有模板内置范围模型。
- SessionGuard只在可见在线周期/恢复检查，6秒超时、强制检查取消旧请求，卸载中止并忽略结果。可信pointerdown/keydown/wheel最多5秒一次activity，合成/隐藏/离线/退出按钮不报活动。普通403、网络及5xx不调用endSession；已知明确401或当前账号/版本与页面不符才结束。
- 跨标签localStorage只触发服务器核验，不直接信任通知为授权/失效。失效响应不清除可能已更新的另一标签Cookie；结束通过完整replace到带持续原因的登录页。
- 未保存整合清理window.onbeforeunload、标记sessionIsEnding及session-ending事件；捕获监听器按合同屏蔽后注册提醒。未知抢先捕获监听器和项目路由守卫必须遵守整合合同，不将T14完整编辑器作为本票要求。

## 本轮独立验证

| 命令/场景 | 实际结果 |
| --- | --- |
| `docker compose run --rm --no-deps checks npm test` | 69/69、0失败/跳过、退出0；`test-results/t05-independent-test.log`，含旧票及本票真实SQL/HTTP/CLI、范围审计回滚和共享锁等待后版本拒绝。 |
| `docker compose run --rm --no-deps checks npm run typecheck` | API/Web通过、退出0；`test-results/t05-independent-typecheck.log`。 |
| 独立期限跨锁等待检查 | `test-results/t05-review-clock.mjs`挂入checks执行，日志 `t05-independent-clock.log`；实际pg_locks看到共享锁等待，等待跨绝对期限/闲置边界后activity分别401 session_expired/session_idle，last_active_at未变。 |
| headers后body网络断流SSR | 如F1：现成Web镜像真实HTTP两路由500、缺重试提示，Next实际报terminated/UND_ERR_SOCKET。 |
| Shell/补丁 | `sh -n templux tests/presentation-installation.sh`、指定差异git diff --check退出0。 |

锁跨期限检查用正常密码API建立SQL会话，独立库设置即将到期的时间，持有真实独占授权锁，再发activity并观察pg_locks等待；释放后核对当前时钟拒绝及无活动延长，不是只读代码或纯定时推测。全部SQL写入/故障注入只在templux_auth_test tmpfs；自有测试账号及容器已清理，默认三服务保持健康。

已核对开发69项/类型检查与本轮结果一致。浏览器多标签/离线与visibility/未保存验收依据开发记录和前端源码核对，没有重新操作真人或重跑整套浏览器。开发visibilityState/visibilitychange为模拟信号，不是OS真实后台调度证明；beforeunload证据为普通回调实际执行、失效回调被绕过及最终导航，未证明工具未展示的原生弹窗外观。此限制保留，不把模拟结果写成全面真实浏览器验收。

Context7核对官方React异步effects/cleanup/竞态、node-postgres同客户端事务，以及MDN fetch/Response/AbortSignal：fetch可在收到响应头后完成，之后读取body仍可能因中断/abort拒绝；该文档与F1实际断流一致。不会仅凭文档或mock把尚未实证的竞态写为发现。

图project `Users-jkoo-git-Templux`，generation `2026-10-14T19:01:53Z`；定位SessionGuard、SSR profile、readSession、退出/范围接口，图原文和双向调用核对。22个证据文件及实现scope覆盖均无已记录缺口，仍为best-effort信号；本票没有新增SQL结构，旧迁移缺口已在先前票直接读取。Postgres短事务/锁指南已用于本轮核对。

## 结论与局限

Standards 0项发现；Spec 1项P2（F1），修复后定向复核。现有69项通过未覆盖成功headers后body中断，不能以其通过替代本轮发现。

未执行完整Linux/WSL2、实体移动设备、全面性能/渗透或真实OS后台调度矩阵；项目自建未保存/导航守卫必须遵守整合合同。T14完整编辑器、T07失败限制、T08人员关联/重置仍是后续票。T03真实飞书人工组织链路仍未完成，与本轮会话审查分开。

只本地提交本审查文档，后续修复及工单处理由TL安排。

## 附录：2026-10-15 F1 独立定向复核

范围：`1747d0aefb0846a3ee7dc6c368b39b707aa86a5c...ba9900750b7c6b26e76b1f2b11d64f49bc52a384`，全部7个修复变更文件。上文初审保持历史原样。

**最新结论：Standards未发现新增问题；Spec F1关闭，未发现新增问题。结合初审其它范围与本次定向验证，T05可按#6范围验收。T03真实组织人工链路仍另列未完成。**

产品修复仅给成功response.json Promise加catch→null，并在null时返回；明确401/403的Next redirect、合法profile映射和页面渲染均保持catch外，没有广泛捕获开发错误或吞导航。已有Unavailable视图接收null，恢复到相应路由重试。

### 本轮实际验证

复用更新镜像，`docker compose up -d --wait ssr-body-api ssr-body-web`后独立执行：

```sh
docker compose run --rm --no-deps checks node --test tests/ssr-body.test.mjs
docker compose run --rm --no-deps checks npm run typecheck
```

专项**8/8、0失败/跳过、退出0**，日志 `test-results/t05-f1-independent-web.log`；API/Web类型检查退出0，日志 `test-results/t05-f1-independent-typecheck.log`。

- 原200响应头后断流、完整错误JSON、gzip解码错误以及挂起body：对/account、/protected、/admin均真实HTTP200项目不可用/网络文案与对应重试href，原路径不变，Location与Set-Cookie为空，无登录误跳或Cookie删除。timeout三路由合计约18秒，实际由既有6秒AbortSignal结束，不是立即mock拒绝。
- 正常有效协议元数据三页面仍正确呈现，没有不可用提示。明确401三路由仍307→`/login?reason=authorization_changed`，正常业务403在protected/admin仍307→account，account保留原路由重试；不吞Next redirect。
- fixture只处理三个profile读取路径，没有登录、会话发行、授权操作或SQL。测试的固定account只是协议呈现正例，不能声称它证明真实身份/权限；此前真实SQL认证/会话验收仍作为不同证据保留。
- 一次性生产API/Web镜像实际检查：tests目录均不存在，退出0；默认API地址没有指向fixture。工具服务仅tools profile且不发布宿主端口。
- 正式管理test入口明确启动auth-database与两个SSR工具服务，checks设置TEST_SSR_WEB_URL；测试对缺失变量使用assert而非skip，标准npm test通配会执行该文件。已读取开发完整77/77、0失败/跳过与专项日志，符合该入口；本轮只重跑相关8项，没有再重复无关SQL锁/全套构建。
- `sh -n templux tests/presentation-installation.sh`和指定差异git diff --check退出0；本轮自有SSR工具容器已删除，默认API/Web/database仍健康。没有重新构建Web、截图、.env/部署/真人或Ego31操作。

### 依据与局限

图generation `2026-10-14T19:18:12Z`，定位及读取profile原文，7个修复证据文件覆盖无已记录缺口，仍为best-effort。Context7先resolve/query官方Next.js，确认redirect抛NEXT_REDIRECT应在catch外；响应体读取异常沿用初审MDN文档核对，本轮真实HTTP覆盖其故障行为。

本轮为macOS/Docker Desktop/Linux容器中的真实Next SSR请求，未重跑跨标签、OS后台、原生弹窗或完整Linux/WSL/移动矩阵；初审相关局限继续保留。协议fixture与真实SQL身份验收明确区分，T03人工未完成不能写成已通过。审查阶段仅追加并本地提交本记录。
