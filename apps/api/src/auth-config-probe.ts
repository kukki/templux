import { authenticationAvailability } from './auth-config.js';
try { console.log(JSON.stringify(authenticationAvailability())); }
catch { console.error(JSON.stringify({event:'authentication_configuration_invalid',message:'部署认证配置校验失败。'})); process.exitCode=1; }
