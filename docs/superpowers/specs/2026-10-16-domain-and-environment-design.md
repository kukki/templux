# #31/#32 域名入口与启动环境合同

基线77c73c73acf1516261d283c7326e0cab0205c8e8；用户已授权方案落地后继续实施，域名/网络未给定时只使用参数及自有合成值。

## 设计选择

1. 保留默认compose.yaml本地回环开发入口；显式compose.traefik.yaml覆盖移除宿主端口，仅entry接external NETWORK_NAME，Host使用独立完整APP_HOST，DOMAIN_NAME保留可选根域语义。router/service由TEMPLUX_PROJECT_NAME+DEPLOYMENT_ENV标识并显式绑定内部8080/websecure/TLS。不配置certresolver、证书或新Traefik。UAT/PROD必须独立Compose项目名。
2. APP_PUBLIC_URL在域名模式必须为https://APP_HOST，启用飞书时回调必须匹配该origin的/api/auth/feishu/callback；原会话Cookie及同源逻辑复用。ENTRY_TRUSTED_PROXY_CIDRS显式配置精确信任代理，沿既有T07右向逐跳剥离，不因外部共享网络自动信XFF。
3. .env.example逐键注解required/optional/conditional及secret/public。shared/environment.mjs负责无eval的有界dotenv语法/注解一致性与有效值校验；只报告键/来源/状态，不输出值。列表独立容器入口；缺失/空串/空白必填非零，可选空保留，飞书仅按真实启用条件检查，外部DB不强制本地DB密码。
4. Compose environment服务在受控管理容器读取项目.env/.env.example并校验有效投影；API/Web/entry通过NODE_OPTIONS预载再次校验各自作用域及镜像示例合同，直接Compose不绕过。管理/迁移使用对应作用域，不把飞书secret传管理容器。环境诊断不连接数据库。
5. 标准wrapper传递明确traefik选择，容器内后续Compose同样选overlay；不依赖操作者手工记忆两次不同文件。env-check/env-list在构建管理/auth probe之前可执行，stdout单JSON，诊断stderr；无宿主Node/npm。
6. 根模板与project-template同步；共享发布添加受控exports/示例资源，既有T29产物/锁/归档不改。若需新包，先提交精确候选方案给TL审查；本轮先证明源码与骨架，不将旧包声称含新功能。

## 来源与范围

只读Catchouse scripts/validate_env.sh、.env.example、server/config.js及Compose/Dockerfile：复用必填/可选/未知键和启动拒绝思想；不照搬业务变量、生产飞书恒必填、shell grep解析或certresolver；不读取真实.env。宿主仍仅Docker/Compose/Shell。

## 验证

先用Node容器对纯环境合同RED→GREEN；Compose实际有效环境/语法/优先级、独立服务启动负例。自有Traefik/合成TLS和独立网络验证Host/跨项目/维护503及代理头；不操作原traefik。相关身份代理回归、types及实际root/project构建按影响执行。Ubuntu真实主机/真实wildcardTLS/Feishu仍未验，用户指南明确预期与局限。所有秘密和资源只自有，完成清理。
