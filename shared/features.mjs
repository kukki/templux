export class FeatureConfigError extends Error {}
export function projectFeatures(){
 const environment=process.env.DEPLOYMENT_ENV??'PROD';
 const flag=process.env.COMPONENT_EXAMPLES_ENABLED??'auto';
 if(!['DEV','UAT','PROD'].includes(environment)||!['auto','true','false'].includes(flag))throw new FeatureConfigError('部署环境或控件示例配置无效。');
 return {componentExamples:flag==='auto'?environment!=='PROD':flag==='true'};
}
