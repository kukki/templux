export type DemoRow={id:string;code:string;name:string;category:string;description:string;reference:string};
const rows:readonly DemoRow[]=[
 {id:'demo-1',code:'DEMO-101',name:'Alpha Beta',category:'展示',description:'这是一条独立合成记录，用于查看长内容、键盘与横向滚动。',reference:'参考标记 A'},
 {id:'demo-2',code:'DEMO-102',name:'Beta',category:'测试',description:'只读演示不提交到正式系统。',reference:'参考标记 B'},
 {id:'demo-3',code:'DEMO-103',name:'中文样例',category:'展示',description:'搜索仅包含名称和编号，未指定的其它列不参与。',reference:'参考标记 C'},
];
export function demoRows():DemoRow[]{return rows.map(row=>({...row}));}
