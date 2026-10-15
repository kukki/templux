# T28 候选：复制控件的项目纯文本反馈

状态：**待独立审查，尚未生成新模板版本**。工程基线 `e9f8a9efe250c2eb85a12bc927a7c19f35eeaee1`；正式稳定仅0.1.0，manifest `bbf6ad9941a784e1301129a067698a79ff23cf2b8b81801582add184ec60c5dc`，源 `66aa7c2d3f5f4fd921837e9804c4fc1d9cbb0bfa`。0.2/0.3均历史测试overlay，不以其为稳定来源。

## 真实源项目与提取

自有A由真实0.1.0发布project建立（`tests/scenarios/t28-project.py a`），安装准确vendor与npm锁并实际Next生产构建，独立运行 `http://127.0.0.1:31128/contribution-demo`。A拥有Harbor品牌、合成reference和路由，需求是项目语言的可见按钮/等待/成功/失败文案；既有CopyButton的label只定义辅助名称，不能覆盖其固定中文反馈。

A先用公开`@templux/web/state/copy`和`/elements/clipboard`组合局部原型，通用helper在A实际导入并运行后提取。没有读取包私有路径、复用真人凭据或增加认证入口。项目页是纯合成元素演示，不承担受保护业务授权验收。

| A来源/需求 | 候选处理 | 所有权 |
| --- | --- | --- |
| contribution-demo/copy-messages.mjs | 原样提取resolveCopyMessages函数到既有shared/copy.mjs | 通用纯文本校验/默认合并 |
| copy-messages.d.mts | 类型追加到shared/copy.d.mts | 可选公开CopyMessages接口 |
| project-copy.tsx局部呈现适配 | 仅将通用messages参数接入既有CopyButton，复用原状态/事件/会话实现，不复制A局部view | 通用组件最小改写 |
| page.tsx、Harbor名称/reference/英文业务文案、config/project-owned.json | 不提取 | A项目所有 |
| 0.1.0 baseline/vendor及自身业务version | 保留 | 不因反哺自动推进 |

## 最小公开差异

仅三个产品文件：`shared/copy.mjs`新增纯函数，`shared/copy.d.mts`新增类型，`apps/web/app/components/elements/copy-button.tsx`新增可选messages。默认全部原文，部分覆盖，八个语义键action/pending/succeeded/retry/empty/denied/unsupported/failed。只允许非空≤300字符普通字符串、拒未知字段/不合法对象/值，不回显值；空白内部不trim。React按文本渲染，无HTML/函数/全局locale切换。messages变化不在store useMemo依赖，不重建复制状态、pending或timer。状态、权限、Clipboard写入、完整原值、1500ms、会话失效规则不变。

没有认证/授权/审计/SQL/迁移修改。新功能是可选扩展，不宣称完整国际化；项目负责传入合适非秘密文案，不能把复制目标/凭据放反馈。通用贡献合同见[reviewed-contributions](../specs/reviewed-contributions.md)。

## RED→GREEN与实际页面

证据 `test-results/t28/`：

- messages-red.log：旧状态模块无新通用扩展，先观察失败；project-prototype-tests.log及messages-green.log：新10项+既有copy12项=22/22。
- candidate-tests-types.log：候选镜像内22/22，API/Web tsc退出0；component-production-types.log包括实际工具路由类型，退出0。
- project-a-build.log：真实0.1.0包消费者npm ci/installed组合验证/Next生产构建通过，无宿主npm；project-a-build-command.json准确命令。
- project-a-browser.log：Ego自有TaskSpace78/p1真实页pending→成功→idle，完整合成值仍含首尾空格。页面内临时Clipboard writer只控制平台边界并finally恢复，没有写个人剪贴板；不是原生权限验收。
- candidate-production-browser.log：实际React组件生产编译工具容器新消费者场景通过：默认中文、部分覆盖、pending中改文案不失状态、成功中改文案不重置timer（1534ms恢复）、HTML形字符串只有文本/0子元素、拒绝就近反馈/重试、空值disabled、form/row副作用0、ending清空；随后原8组CopyButton异步/键盘/重试/目标替换/卸载/ending场景全通过。
- Ego截图超时（project-a-screenshot.log）；按授权fallback用自有命名agent-browser会话templux-t28-contribution，project-a-fallback.png实际成功。初始开发模式页未水合，Turbopack及Webpack开发尝试均未作通过；改为实际生产编译工具路由后行为成功。未为修工具环境改生产逻辑。

工具路由只bind到自有容器，不写入apps源或project-template，不进入包/生产路由。维护API未启动，因此页面准确显示维护状态未知；不把组件演练当维护或正常SQL身份验收。没有真实剪贴板权限、SQL/身份/全主题重复矩阵。

## 发布与另一项目（审查后才执行）

审查必须绑定候选commit/patch/hash和以上证据，作者核对不代替独立审查。批准后才生成本机隔离0.1.1-t28.1；来源是恢复的正式0.1.0选定源和原骨架，加受审三文件及明确发布元数据工具overlay。稳定198文件均可从原commit逐字节恢复（stable-source-audit.json）；原数据/认证/资产不变，不继承历史.2/.3标签/资产或main新增T27项目样板。

必要发布overlay仅复用既有release build/verify的准确SemVer、from支持边、完成前校验，准确列两个工具hash和派生项目验证器差异；它不包含提案引擎/发现/调度功能。主版本/协议1/config1/schema0010/Node24/Next16组合不变。B自行选择准确目标，T26生成候选并在一次性副本完整apply/vendor全等、实际API/Web构建与页面受益，业务/config/version保持。当前尚未执行此依赖审查步骤，不宣称全票完成。
