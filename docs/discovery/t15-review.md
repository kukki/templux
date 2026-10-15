# T15 独立审查：按行编辑与弹窗保存生命周期

2026-10-15，审查者：审查。固定范围 `efb538ccaaf220083827917f30bac8be9d1e3b76..60189aea45805a7088c1e683c27c9327947f7ddf`，开始时HEAD为上界、工作区干净。同一独立审查者按Team治理依次执行Standards/Spec，不新增成员。

依据Gitea #16及已读取父规格#1、ADR0012/0020、T14最终合同/三项历史发现、row-and-dialog-editing、T15计划/验收与全部19文件差异。使用code-review、codebase-memory、Context7、ego-browser及完成前验证流程。search→trace→snippet核对EditSession/EditableTable及共享控制器，改动19路径coverage均metadata_match/无报告缺口；best-effort非完整性证明，另直接读源码/测试/配置。MDN官方核对dialog.showModal、cancel与preventDefault语义。

## Standards

**0项发现，无阻塞。**

共享createEditor控制基线/代次/截止与回执；EditSession协调保存/核验/焦点，EditableTable显式接入ID/version，弹窗使用原生dialog。普通表单仍复用原合同，局部requestDiscard与全页requestLeave责任明确；公共模块不依赖examples。可见文案集中copy、样式沿品牌变量，不新增强制呈现键。没有示例业务API/SQL/迁移/生产fixture或认证后门。未发现本范围需修复的职责混杂或预留未来业务接口，不重复报告工具已检查的类型/风格问题。

## Spec

**0项发现，无阻塞；T15可按#16验收。**

- `editable-table.tsx:6–15` 未显式editing时仍只读；单表一个活动行、稳定ID唯一检查，冻结本行版本与session。最新来源缺失/版本变化/取消配置仍保留编辑区并禁保存；等待旧结果通过最新匹配与EditSession冲突判断转未确认，不覆盖父记录。onCommit仍由项目最终核对版本，真实后端并发校验不被内存模拟替代。
- `edit-navigation.tsx:16–25` 局部requestDiscard仅处理指定源，全页requestLeave才处理全部；blocked拒主动离开。FormDemo还原改为自身requestDiscard，行/弹窗取消不清其它编辑器，T14消费者先取消和hash边界保留。
- `edit-session.tsx:8–21/36–46` 原生模态/标题、字段初始焦点、错误焦点与返回焦点；按钮/取消/Escape统一close，遮罩无关闭路径。saving时字段/按钮禁用、事件层及控制器都拒取消/关闭/重复写入；焦点仍留模态内。session-ending无条件cancel等待、abort核验并close，原会话退出优先，不用保存锁留住失效访问。
- `editor.mjs:3/20–43` 截止默认由EditSession设30000ms，可配1–300000并要求提示；timeout解锁并保留输入/attemptId/提交快照，不自动重试。128位getRandomValues操作ID不被当身份或服务端幂等保证。迟到成功/异常经race/generation与accepted结果边界不提交父记录；cancel/reset使旧receipt无效。not-applied仅允许下一次明确保存，saved核验保留后来值和已暴露错误。
- `edit-session.tsx:23–35` targetKey/来源冲突检查、alive及核验abort/当前receipt匹配防止旧目标/卸载晚提交；核验unknown/异常保留未确认、解除核验忙碌。超时关闭或刷新丢本地receipt的外部台账责任明确，取消不声称后端写入回滚。403/网络不退出；真实写入无法确定时项目须映射unconfirmed，401沿sessionFetch/endSession。
- 合成示例提供显式行启用、行/弹窗互斥、成功/字段/表单/403/网络/等待/超时核验、版本刷新；只在接受提交或明确核验后更新显示，源、权限、台账均需真实项目提供。未扩大其它后续票范围。

## 独立实际验证

复用checks/Web镜像，不建数据库或凭据。自有dev容器同时挂两个版本化fixture到测试路由，API_INTERNAL_URL指向不可用本机端口1、DEV；只在本地127.0.0.1:31043开放。首个goto早于dev就绪出现ERR_EMPTY_RESPONSE，HTTP200后恢复同一TaskSpace55，未另开空间或改实现。

| 命令/场景 | 实际结果/证据（test-results/） |
| --- | --- |
| checks `node --test tests/editor.test.mjs tests/editor-deadline.test.mjs tests/search.test.mjs tests/multiselect.test.mjs tests/list-state.test.mjs tests/presentation.test.mjs` | **43/43，失败/取消/跳过0**；t15-independent-targeted.log |
| checks `npm run typecheck` | API/Web退出0；t15-independent-typecheck.log |
| 自有组件容器workspace Web typecheck | 含fixture退出0；t15-independent-fixture-typecheck.log |
| 五个editor/navigation/session/table/form-demo镜像与宿主SHA256 | 全相同、diff退出0；independent-image-hashes.log/source-hashes.log |
| 版本化scopedUndo + controlledDialog | 局部还原及6场景通过；t15-independent-components.json |
| T14 controlledEditor/hashLinks/newerValidation/leavingBoundaries/consumerOrdering | 11状态、4hash、Required/aria-invalid、7链接边界、7消费者顺序均通过；t15-independent-t14-regressions.json |
| 最终生产Web镜像自有容器HTTP /t15-component | 404；t15-independent-production-boundary.log |

独立控制器专项实际覆盖截止释放/未确认receipt/禁止重试、锁内改值reset重复submit拒绝、强制cancel、核验旧快照不丢新值/Required、not-applied后新attempt隔离、cancel/reset丢旧receipt、非安全上下文getRandomValues。其余专项包括原普通编辑、HTTP迟到结果、列表配置/CLI等，不冒充生产写API。

独立组件在实际React/DOM中观察：普通表单还原回初值而Inline draft保持；首次无效保存聚焦字段且调用0；保存中显式submit/Escape/cancel事件/遮罩不关闭且仅1调用；接受成功提交1次、关闭并恢复触发焦点；dirty保留/放弃正确；保存期间切目标保留Target draft/禁保存/不增加commit；卸载后旧返回不提交。受影响T14完整重跑确认共享控制器与局部导航变更没有重现历史三项问题。

## 开发证据与限制

已核对开发rows/modals/responsive/final-components/delivery-browser JSON与验收，查看最终desktop/narrow弹窗截图。开发证据覆盖默认只读/显式按行、失败保留/刷新冲突，超时早核验unknown/晚返回不假保存/明确核验不重试，390表内横滚与短屏弹窗滚动，最后普通表单还原不动Row retained、标题EDIT-101，以及saving时真实CLI撤权后200→401、104ms持续原因重登。这些完整行/模态浏览器、正常密码/SQL撤权及截图为**开发执行、独立核对证据**；本次独立执行限上表，不声称复跑整个生产身份矩阵。

开发181/181完整suite早于取消回执、crypto、焦点和局部还原最后修正；最终43专项/typecheck/构建及最终组件/生产页面分别记录，**未将181说成最终全量**。本次未重复全suite、SQL/无关构建或全平台矩阵。核验异常/unknown/目标冲突/卸载隔离另经源码路径检查，未另建立所有异常与所有控件组合的浏览器矩阵。

保存/核验源为合成Promise，abort只取消本地等待；真实权限、乐观版本、网络写入未确认分类、操作台账及刷新后核验仍由项目实现。只读/编辑不是授权。受控confirm和Chromium触屏/视口不替代所有浏览器/OS软键盘/辅助技术/TLS/原生beforeunload；后台计时不保证精确。T03真实飞书组织人工仍未完成另列，内存/密码测试不替代。

TaskSpace55已finish({keep:[]})，自有dev及生产边界两个容器删除，independent-cleanup.log；原api/database/web healthy，API ready/schema0004。未迁移/重启原服务，.env/原presentation/真人/Ego31及通知不动；本次只新增审查文档/忽略目录证据，本地提交，不push/关票，不宣称完整首版交付。
