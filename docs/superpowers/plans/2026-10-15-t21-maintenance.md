# T21 持续维护与停服入口实施计划

> **For agentic workers:** Execute in this session with tests and the existing Team independent review. Do not spawn agents or touch original deployment.

**Goal:** Gitea #22 / #1 85–86，独立持续提醒及可实际停止业务后仍提供维护页的受控运维闭环。
**Architecture:** 新entry长期容器使用API发布中的Node/pg和共享呈现配置，读取同一Postgres维护单例；online反代web，offline返回统一503维护页；连接/结构未知则不可用503，不伪造计划状态。DB/entry保持运行。CLI为ADR0026宿主权限，不新增Web变更API；普通人员/Agent可读必要公开提醒，无管理授权提升。提醒状态与gate状态分开。
**Tech:** Next.js/React现有UI、Fastify、Postgres18、pg、Node24 HTTP、Compose。原0004与.env等不改。

## 具体合同 / 安全顺序

1. 新0009：维护单例version、active、planned_at、message、phase(online/offline)、updated_at。核心可写数据表statement trigger取得共享事务锁再用VOLATILE函数新快照检查online；项目新表显式复用同guard，不能宣称自动涵盖任意外部写入。维护、审计及迁移元数据不受业务屏障限制。普通读仍不构成写屏障证明。
2. 管理命令status/start/cancel/end/halt/resume/rescue。非status须confirm，常规变更须expected-version；start需带时区的at与合法公开message。CAS在锁内检查；每次非幂等修改+名单审计同事务，COMMIT不明不重试/不执行后续停服。无自报应用身份。
3. session级try维护操作锁覆盖整个CLI停服/恢复，防止跨容器SQL与Docker动作交错；事务exclusive写锁等待已有写者提交/回滚，再提交offline+审计。新写在锁后读新phase并拒绝。然后停web/api；若Docker失败入口仍关闭，报告局部失败，按状态人工核验后显式重试。核心接口503，不误401。
4. resume先核对offline版本，启动已有镜像web/api并--wait健康检查（不自动build/migrate/deploy）；之后强审计切online。若启动/审计失败仍offline。提醒保持，另行end清除。start只启动常规服务，不绕过offline；既有stop是全停，不声称有维护入口。
5. rescue为明确宿主救援，DB不可达时只停web/api，返回containersStopped/barrierVerified=false/auditSaved=false与stderr诊断，不伪称持久状态。入口DB故障显示未知503；DB恢复后须核对SQL状态再决定halt/resume，不自动开放承诺。
6. public /api/maintenance仅必要内容/版本/服务器时刻/phase，无操作者、私密路径/身份；Web独立non-dismissible banner、轮询/恢复可见检查，倒计时归零保持；不借用toast/队列，401 ending清旧提示，失败显示未知而非自动结束。位置不遮挡普通toast和窄屏菜单。
7. entry剥除客户端伪造IP声明，按已有显式可信代理CIDR计算来源；Web仅信明确entry DNS peer的内部声明，直连Web仍不信。无公网通配trusted proxy，保持T07组合限制。

## 文件与验证切片

- 数据/状态：database/migrations/0009_maintenance.sql、api maintenance.ts / maintenance-cli.ts、database结构检查、audit名单。先写真实SQL状态/并发写屏障/审计失败/版本/未知提交测试，RED后实现。
- 运维/入口：api maintenance-entry.ts、shared维护安全HTML/校验、manage命令及Compose entry。实际CLI确认/JSON/恢复/幂等，独立Compose停业务仍503、DB故障救援验证。
- UI：MaintenanceNotice独立挂根layout，集中copy/CSS；helper倒计时测试，真实密码人员/Agent页刷新/导航/满toast/到点/取消结束、桌面窄屏截图。
- 回归：迁移前0600隔离0008dump，scratch真实restore核验后只对隔离库迁移0009；专项→适当完整套件/APIWeb typecheck/三镜像构建，最终源码hash/镜像对应。清理自有容器/卷/密码/浏览器，原服务healthy不变。

## 非范围与限制

不自动部署、不自动恢复DB、不新增备份产品命令(后续票)、不建业务表/SQL写测试后门、不做集中日志或通知外发。entry/DB/整机/网络均停时无法展示页面；上线须把公共流量接到entry而非绕过Web。真实飞书人工验收继续独立pending，不用密码测试冒充完成。

## 实施期间补充：提交回执未知须保持公开入口关闭

TL强调此边界后追加0010（不改已应用0009），新增gate_version，只在phase改变时递增。恢复先服务健康，再提交online/审计，只有COMMIT被确认后才原子写共享卷非秘密释放回执{schemaVersion,gateVersion}。entry及API必须匹配才开放；SQL实际提交但ACK丢失时旧回执不匹配，继续503。phase=online只是数据库实际事实，不冒称公开入口已恢复。恢复文件失败返回未确认，显式status核验再resume；普通提醒版本变化不使正常回执失效。新库gate_version=0且回执不存在可初次启动，已有回执不匹配/损坏/缺失(version>0)不放行。维护文件不含message、身份或秘密，不作为审计替代；操作锁覆盖发布。

SQL屏障判断实际已提交phase；恢复SQL确已online但回执未确认时，公开HTTP仍关闭，直接数据库的宿主写入者拥有更高权限，必须由运维协调，不假称数据库能读取共享文件或约束恶意DB owner。未来恢复流程需同时处理该安全门闩。Docker/DB连接丢失仍须停止自动化、核对在途命令，不能把操作锁说成跨系统原子事务。
