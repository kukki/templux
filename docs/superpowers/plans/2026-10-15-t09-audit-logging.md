# T09 审计查询与运行日志留存 Implementation Plan

> **For agentic workers:** 按Team权限由开发本人执行，使用executing-plans；TL另排独立审查，不新增子代理。

**Goal:** 管理员追查真实审计，自动清理默认90天审计，运行日志结构化且容量有界，安全通过Docker/CLI读取。

**Architecture:** 复用持久会话/权限与已有强事务审计，新增归属/可信度/结果快照，不捏造历史身份。清理短批、try事务锁、生命周期防重入；API/Web允许字段日志与Docker json-file轮转，无集中平台/网页运行日志/导出。

**Tech Stack:** PostgreSQL/pg、Fastify/Pino、Next/React、Node24、Compose/Docker。

- [x] 先真实SQL/HTTP红灯，隔离0007备份并scratch恢复；PG技能后新增不可变0008归属/结果/时间索引。
- [x] 细化安全审计writer（已验证应用身份/宿主声明/匿名/历史），名单化详情与Agent责任快照；原强审计/登录例外保持，认证失败与非DB运维最佳努力策略明确。
- [x] 审计只读API：accounts:manage+audit:read；事件/操作者标识文本、source/target/result、含时区from含/to不含、分页。安全DTO含微秒原始时间与来源证据，不曝凭据/私有交付。
- [x] 默认90天、每小时、1000/批最多10批；索引范围扫描、try advisory锁、防重入、每批清理及摘要审计同事务，服务停机清timer/等待当前批，故障不删。
- [x] API/Web安全结构化诊断，丢弃raw请求/错误消息/秘密字段；Docker每容器10MiB×10份、默认长期3服务约300MiB容量预算，约14天非保证；配置校验/CLI读取保持结果诊断分流。
- [x] 管理审计页沿品牌变量、集中中文、管理时区秒显示；只查询不导出，桌面/窄屏实际验证。
- [x] SQL/HTTP/CLI/browser事件贯通、权限/筛选/分页/微秒边界、故障/清理并发/生命周期、真实Docker轮转磁盘预算+读取；完整suite/typecheck。
- [x] 记录合同/命令/局限；清理本票隔离资源，保留原0004/真人/Ego31/.env；本地提交，报告TL并结束。
