# #31/#32 Implementation Plan

**Goal:** Root与新项目接现有Traefik，并在启动前拒绝无效环境，提供Ubuntu实测指南。
**Architecture:** 显式Compose overlay + 共用作用域环境合同/容器诊断 + 启动预载；不改认证/SQL。
**Tech Stack:** Node24、Compose2.24.4+、Traefik Docker provider、现有core/web。

- [ ] 写environment/域名安全合同测试并在容器观察RED。
- [ ] 实现shared/environment解析/投影/CLI/启动模块、示例元数据，GREEN。
- [ ] root/project Compose和Docker资源、wrapper/管理编排overlay、诊断入口。
- [ ] 真实隔离Compose负例/有效值/优先级与自有Traefik Host/TLS/维护/代理测试。
- [ ] 类型/相关安全回归；记录镜像/源码/命令/未验证项，不机械全量。
- [ ] Ubuntu指南/验收/发布来源边界；自有清理、本地提交交审查。

按executing-plans由当前开发顺序执行；共享工作区保留他人改动。设计已由当前任务授权自主继续，无额外常规批准停等。
