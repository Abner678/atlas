/* =========================================================
   闭环工坊 · 数据层
   ---------------------------------------------------------
   16 条赚钱路径 × 4 种商业模式（闭环原型）
     oneoff        一次性买断
     service       免费/低价设备 + 持续服务费
     subscription  订阅 / 会员
     marketplace   平台抽佣
   每个方法给一组「基准经济」，四种模型在此基础上派生默认参数。
   ========================================================= */
window.LOOP_LAB = {
  archetypes: [
    {
      id: "oneoff",
      no: "01",
      name: "一次性买断",
      en: "ONE-OFF",
      tag: "卖一件，收一次",
      color: "#ff8a5c",
      blurb: "现金流最快，复购最弱。靠选品、渠道和周转赚钱。",
      formula: "利润 =（售价 − 单件成本 − 交付 − 获客）× 销量",
      steps: [
        { t: "获客", d: "内容 / 渠道 / 地推" },
        { t: "转化", d: "样机、对比、试用" },
        { t: "交付", d: "现货 / 安装 / 激活" },
        { t: "收款", d: "一次性回款" },
        { t: "复购", d: "配件 / 延保 / 换新" },
        { t: "再投入", d: "补货 / 投流 / 开城" }
      ],
      risks: ["压货占用现金", "退货与售后吃掉毛利", "只靠低价，没有复购"]
    },
    {
      id: "service",
      no: "02",
      name: "免费 + 服务费",
      en: "FREE + SERVICE",
      tag: "先送设备，再收月费",
      color: "#6fd3a2",
      blurb: "用设备换长期关系。前期现金流出大，回本周期是生死线。",
      formula: "月收入 = 月费 × 在网用户；回本 =（设备成本 + 获客 − 设备款）÷ 月毛利",
      steps: [
        { t: "获客", d: "免费 / 0 元购机" },
        { t: "转化", d: "信用审核、合约" },
        { t: "交付", d: "装机、激活、培训" },
        { t: "收款", d: "首月服务费" },
        { t: "留存", d: "续费、增购服务" },
        { t: "再投入", d: "扩品、开城" }
      ],
      risks: ["设备补贴沉没成本", "流失率一高就永远回不了本", "合约与押金合规"]
    },
    {
      id: "subscription",
      no: "03",
      name: "订阅 / 会员",
      en: "SUBSCRIPTION",
      tag: "按月收，持续交付",
      color: "#7fb2f0",
      blurb: "收入可预测，但必须持续交付价值；留存比拉新更值钱。",
      formula: "月收入 = 月费 × 订阅用户；LTV =（月费 − 交付）÷ 月流失",
      steps: [
        { t: "获客", d: "内容、试用、转介绍" },
        { t: "转化", d: "7 天体验 / 首月优惠" },
        { t: "交付", d: "每周固定价值" },
        { t: "收款", d: "月付 / 年付" },
        { t: "留存", d: "权益升级、社群" },
        { t: "再投入", d: "内容、产品、渠道" }
      ],
      risks: ["续费率低于 80% 很难做大", "权益越堆越重", "年付退款与合规"]
    },
    {
      id: "marketplace",
      no: "04",
      name: "平台抽佣",
      en: "MARKETPLACE",
      tag: "不囤货，赚交易",
      color: "#c39bf0",
      blurb: "轻资产、可规模，但要先解决冷启动与信任；抽佣率是平衡术。",
      formula: "收入 = 交易额 × 抽佣率；毛利 = 收入 − 履约 − 获客",
      steps: [
        { t: "获客", d: "双边冷启动" },
        { t: "转化", d: "匹配、担保、评价" },
        { t: "交付", d: "履约与纠纷处理" },
        { t: "收款", d: "按成交抽佣" },
        { t: "留存", d: "复购、转介绍" },
        { t: "再投入", d: "补贴、开类目" }
      ],
      risks: ["跳过平台私下交易", "双边补贴烧钱", "资质与资金池合规"]
    }
  ],

  methods: {
    M01: { unit: "件", price: 2999, cost: 1800, delivery: 60, cac: 160, fee: 129, churn: 3, newCustomers: 20, growth: 8, commission: 8 },
    M02: { unit: "单", price: 45, cost: 12, delivery: 0, cac: 8, fee: 399, churn: 8, newCustomers: 40, growth: 10, commission: 10 },
    M03: { unit: "单", price: 6000, cost: 600, delivery: 0, cac: 400, fee: 99, churn: 5, newCustomers: 4, growth: 6, commission: 8 },
    M04: { unit: "盒", price: 129, cost: 55, delivery: 12, cac: 25, fee: 39, churn: 6, newCustomers: 60, growth: 12, commission: 10 },
    M05: { unit: "件", price: 199, cost: 90, delivery: 12, cac: 45, fee: 29, churn: 7, newCustomers: 40, growth: 10, commission: 10 },
    M06: { unit: "件", price: 399, cost: 120, delivery: 15, cac: 60, fee: 59, churn: 4, newCustomers: 30, growth: 8, commission: 12 },
    M07: { unit: "单", price: 99, cost: 50, delivery: 8, cac: 30, fee: 199, churn: 6, newCustomers: 50, growth: 15, commission: 10 },
    M08: { unit: "单", price: 1999, cost: 200, delivery: 0, cac: 300, fee: 299, churn: 6, newCustomers: 6, growth: 8, commission: 10 },
    M09: { unit: "件", price: 68, cost: 28, delivery: 10, cac: 12, fee: 29, churn: 5, newCustomers: 80, growth: 12, commission: 10 },
    M10: { unit: "单", price: 19800, cost: 6000, delivery: 0, cac: 1500, fee: 1999, churn: 3, newCustomers: 2, growth: 6, commission: 8 },
    M11: { unit: "件", price: 680, cost: 220, delivery: 20, cac: 80, fee: 99, churn: 3, newCustomers: 8, growth: 6, commission: 10 },
    M12: { unit: "单", price: 60, cost: 20, delivery: 0, cac: 15, fee: 99, churn: 8, newCustomers: 120, growth: 20, commission: 10 },
    M13: { unit: "件", price: 29.9, cost: 14.2, delivery: 4, cac: 3, fee: 19, churn: 5, newCustomers: 300, growth: 15, commission: 8 },
    M14: { unit: "单", price: 2999, cost: 600, delivery: 0, cac: 500, fee: 499, churn: 5, newCustomers: 10, growth: 18, commission: 12 },
    M15: { unit: "笔", price: 50000, cost: 0, delivery: 0, cac: 0, fee: 0, churn: 2, newCustomers: 1, growth: 5, commission: 20 },
    M16: { unit: "单", price: 999, cost: 150, delivery: 0, cac: 120, fee: 199, churn: 6, newCustomers: 12, growth: 10, commission: 10 }
  },

  presets: [
    {
      id: "phone-sell",
      label: "卖手机 · 一次性",
      hint: "一台 2999，毛利 759",
      method: "M01",
      arch: "oneoff",
      params: { price: 2999, cost: 1800, delivery: 60, cac: 160, newCustomers: 20, growth: 8 }
    },
    {
      id: "phone-service",
      label: "0 元手机 + 月费",
      hint: "先送机，月费 199",
      method: "M01",
      arch: "service",
      params: { fee: 199, cost: 1800, deviceFee: 0, delivery: 20, cac: 150, churn: 3, newCustomers: 12, growth: 10 }
    }
  ],

  seeds: [
    {
      id: "seed-phone-buy",
      name: "手机 · 一次性买断",
      note: "经典差价：卖一台，赚一台的毛利。",
      methodId: "M01",
      archId: "oneoff",
      creator: "样本 A",
      params: { price: 2999, cost: 1800, delivery: 60, cac: 160, newCustomers: 20, growth: 8 }
    },
    {
      id: "seed-phone-sub",
      name: "手机 · 0 元送机 + 月费",
      note: "同一台手机，换成 24 个月的服务关系。",
      methodId: "M01",
      archId: "service",
      creator: "样本 B",
      params: { fee: 199, cost: 1800, deviceFee: 0, delivery: 20, cac: 150, churn: 3, newCustomers: 12, growth: 10 }
    },
    {
      id: "seed-community",
      name: "社区团购 · 预售 + 自提",
      note: "先有订单再采购，用周转替代库存。",
      methodId: "M01",
      archId: "oneoff",
      creator: "杭州样本",
      params: { price: 89, cost: 58, delivery: 6, cac: 7, newCustomers: 160, growth: 14 }
    },
    {
      id: "seed-pet",
      name: "宠物上门 · 包月服务",
      note: "把一次 60 元的跑腿，做成 399 元的月卡。",
      methodId: "M02",
      archId: "subscription",
      creator: "成都样本",
      params: { fee: 399, delivery: 60, cac: 300, churn: 6, newCustomers: 18, growth: 12 }
    },
    {
      id: "seed-match",
      name: "本地婚介 · 成交抽佣",
      note: "不囤资源，靠本地信任与匹配效率。",
      methodId: "M03",
      archId: "marketplace",
      creator: "长沙样本",
      params: { price: 6800, commission: 6, delivery: 120, cac: 600, churn: 4, newCustomers: 6, growth: 8 }
    },
    {
      id: "seed-curvy",
      name: "大码女装 · 会员订阅",
      note: "细分人群的复购，比一次性成交值钱。",
      methodId: "M05",
      archId: "subscription",
      creator: "广州样本",
      params: { fee: 129, delivery: 45, cac: 120, churn: 7, newCustomers: 26, growth: 10 }
    }
  ]
};
