# T05 F1 响应体故障修复验收

日期2026-10-15。基线 `1747d0aefb0846a3ee7dc6c368b39b707aa86a5c`（实现677430f及独立初审）。保留docs/discovery/t05-review.md初审原结论。

## 先核验、后修复

按receiving-code-review/systematic-debugging，读取初审和故障脚本。使用旧Web镜像、独立templux-t05-f1-body故障服务发送200 headers、未完成JSON并100ms后断流。真实HTTP /account及/protected均500，HTML无“重试”或“连接暂不可用”；记录t05-f1-old-account.html、t05-f1-old-protected.html。没有用mock Response代替SSR复现。

根因：fetch等待已被catch，但成功Response的body消费仍是另一个可能拒绝的Promise。最小产品修复仅成功response.json捕获及null分支两行；保持合法profile映射和401/403控制流在catch之外，不捕获整个profile或页面渲染，也不吞Next redirect。

Context7先resolve再query Next.js和MDN，核对redirect抛NEXT_REDIRECT、应在catch之外，以及Response.json的SyntaxError/TypeError/AbortError和headers后读取中止语义。参考链接在会话合同的F1补充中。

## 真实Web HTTP回归

新增tests/fixtures/ssr-body-server.mjs，只在tools测试容器作为上游协议/故障服务，限定三个profile读取路径；没有认证、发行session、授权或SQL。合法元数据正例仅验证SSR解析/呈现，不宣称它完成真实身份验证；原有真实认证SQL/HTTP套件继续运行。ssr-body-web使用正式Web镜像，内网API地址指向该服务，默认部署API不变。

`docker compose run --rm --no-deps checks node --test tests/ssr-body.test.mjs`：**8/8通过，0失败/跳过、退出0**，t05-f1-web-regression.log。每种故障均对/account、/protected、/admin真实HTTP验证：

- 200 headers后body断流（100ms）；
- 完整但语法无效JSON；
- Content-Encoding gzip与body不符造成解码/读取失败；
- 200 headers与部分body后挂起，由现有6秒AbortSignal中止（3路由总约18秒）。

所有故障返回200项目不可用视图，原URL路径不变，Location与Set-Cookie均无值；显示集中配置的服务/网络提示、重试及对应href。合法profile三路由正常呈现。明确401三路由307→/login?reason=authorization_changed；正常业务403在protected/admin为307→/account，account为原路由不可用/重试，不误跳登录；没有删除Cookie。

管理test入口启动独立ssr-body-api/ssr-body-web（tools profile），检查容器通过TEST_SSR_WEB_URL调用，保证回归可重复运行而非只有临时手工脚本。生产API/Web镜像不复制tests；没有生产测试路由、凭据改动或登录后门。

## 最终命令、清理与边界

本轮必要构建web/checks/management/auth-config-probe（管理test入口有一行工具服务启动调整），t05-f1-build.log退出0；默认Web更新后健康，t05-f1-web-start.log。没有额外SQL对象/迁移/数据库写入设计，没有重复跨标签/截图或独立SQL锁故障脚本。

完整suite/typecheck结果及清理在本记录末尾补充。工作区保留其他提交，未修改.env、真人权限或Ego31，不发通知、不推送/关闭工单。测试fault元数据和Cookie标记均为合成值，没有记录真实凭据。平台macOS/Docker Desktop/Linux容器上的Next SSR真实HTTP，未重复完整平台或浏览器矩阵；T03真实组织验收仍另列未完成。

## 最终交付结果

`./templux test --non-interactive --json`：**77/77、0失败/跳过、退出0**；`./templux typecheck --non-interactive --json`：API/Web通过、退出0。日志 `test-results/t05-f1-final-{test,typecheck}.{json,log}`。完整套件复验既有69项，仅未另外手工重复SQL锁或浏览器场景。

`sh -n templux tests/presentation-installation.sh`与`git diff --check`通过。旧镜像复现用的两个独立命名容器、ssr-body-api/ssr-body-web及auth-database均已删除，部署API/Web/database仍健康。

codebase-memory已重新索引和检查本票5条代码/工具证据路径覆盖，无已记录缺口；fixture源码直接编写读取及真实HTTP验证，图信号best-effort，不声称全仓完整。没有新增浏览器空间、截图、密码文件或迁移。
