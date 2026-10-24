/*!
 * 需求 / 人性 映射层
 *
 * 16 种赚钱逻辑回答的是「怎么赚」，这里回答「为什么有人愿意付」。
 * 两个视角：
 *   needs   —— 马斯洛改良版 6 层（生存 / 安全 / 归属 / 尊重 / 自主 / 意义）
 *   drives  —— 七宗罪 + 恐惧 + 爱 + 成就（10 个驱动力）
 *
 * 说明：七宗罪不是心理学理论，是营销语境里好用的直觉分层。
 * 它解释的是「情绪怎么被定价」，不能解释「人为什么活着」——
 * 所以下面同时保留了三个正向驱动，否则整张表会显得很犬儒。
 */
window.NEEDS = {
  meta: {
    note: '同一件事可以被不同需求解释：买便宜货既可能是「生存」（真缺钱），也可能是「贪婪」（不缺钱但想占便宜）。下面的归类取主要那一层，次要的放在 why 里说。',
  },

  needs: [
    { id: 'survive', name: '生存', color: '#b4453a', note: '吃、住、健康、省钱——不满足就活不好' },
    { id: 'safety', name: '安全', color: '#2f5d8a', note: '怕出错、怕被骗、怕来不及——买的是确定性' },
    { id: 'belong', name: '归属', color: '#2f6b4f', note: '被理解、被接纳、不孤单' },
    { id: 'esteem', name: '尊重', color: '#76508a', note: '体面、身份、被看得起' },
    { id: 'autonomy', name: '自主', color: '#c2762a', note: '不想被安排、想自己说了算' },
    { id: 'meaning', name: '意义', color: '#8a6a2f', note: '做成一件事本身的价值' },
  ],

  drives: [
    { id: 'greed', name: '贪婪', color: '#b4453a', group: '罪', note: '想用更少的代价拿更多' },
    { id: 'sloth', name: '懒惰', color: '#5a6b8a', group: '罪', note: '想省事，不想动手、不想动脑' },
    { id: 'pride', name: '傲慢', color: '#76508a', group: '罪', note: '想比别人高一点、想被看见' },
    { id: 'envy', name: '嫉妒', color: '#a24a6b', group: '罪', note: '想成为别人那样，或不想被比下去' },
    { id: 'lust', name: '色欲', color: '#c2537a', group: '罪', note: '对好看、亲密、身体的偏好' },
    { id: 'gluttony', name: '暴食', color: '#b8712f', group: '罪', note: '想多吃一口、多囤一点' },
    { id: 'wrath', name: '暴怒', color: '#a33a2a', group: '罪', note: '情绪被点燃，想站队、想骂、想赢' },
    { id: 'fear', name: '恐惧', color: '#3f4a5a', group: '另', note: '怕损失、怕错过、怕落后——比贪婪更强' },
    { id: 'love', name: '爱', color: '#2f6b4f', group: '正', note: '给家人、给宠物、给自己在乎的东西' },
    { id: 'achieve', name: '成就', color: '#8a6a2f', group: '正', note: '想做成、想变强，哪怕没人看见' },
  ],

  /* 每条路径：主需求、主驱动、为什么愿意付 */
  map: {
    M01: {
      needs: ['survive'], drives: ['greed'],
      why: '人不是想买便宜货，是想「占便宜」。同一件东西，知道自己比隔壁买得便宜，那一刻的得意本身就是商品。所以差价生意卖的从来不是价格，是「我买对了」的感觉。',
    },
    M02: {
      needs: ['autonomy', 'safety'], drives: ['sloth'],
      why: '买的是「不用做」，不是「做完」。价格和这件事的厌恶程度成正比，和它的难度关系不大——倒垃圾不难，但没人想倒。',
    },
    M03: {
      needs: ['safety'], drives: ['sloth'],
      why: '人怕的不是花钱，是选错。中介卖的是「我替你把过关了」的安心，佣金就是这份安心的定价。',
    },
    M04: {
      needs: ['esteem'], drives: ['gluttony', 'pride'],
      why: '同样的东西装进盒子就变成「心意」。人买的是「我送得出手」，不是「这东西值多少钱」。包装的钱，实际是替收礼人付的。',
    },
    M05: {
      needs: ['belong', 'esteem'], drives: ['love'],
      why: '人愿意为「你懂我」付溢价。大市场卖功能，小市场卖身份认同——大码女生不是要「一件衣服」，是要「一件不用解释的衣服」。',
    },
    M06: {
      needs: ['esteem', 'safety'], drives: ['pride'],
      why: '品牌同时干两件事：替你省掉判断（省力），替你宣告身份（体面）。溢价买的是确定性 + 归属感，不只是那张标。',
    },
    M07: {
      needs: ['belong', 'esteem'], drives: ['envy'],
      why: '粉丝买的不是你的知识，是「我也想成为你那样」的可能性。人设是欲望的投影——你越具体，他越能把自己放进去。',
    },
    M08: {
      needs: ['safety', 'autonomy'], drives: ['fear'],
      why: '人怕走弯路。经验的价值 = 你替他省掉的试错成本 × 他对试错的恐惧程度。所以卖经验必须先讲清「不知道会怎样」。',
    },
    M09: {
      needs: ['survive', 'belong'], drives: ['greed', 'love'],
      why: '价差是地理套利，但「老家的味道」卖的是乡愁。同一件土特产，贴上「家乡」能贵三倍——多出来的部分是情感，不是运费。',
    },
    M10: {
      needs: ['safety'], drives: ['sloth', 'fear'],
      why: '人不是不会做，是怕做错。抄作业卖的是「别人验证过」的安全感。所以模仿的关键不是抄动作，是抄那个「已经被验证」的证据。',
    },
    M11: {
      needs: ['esteem'], drives: ['pride', 'greed'],
      why: '「人无我有」的定价权来自独占感。稀缺不是数量问题，是「别人拿不到」的问题——限量 100 件但人人能买，就不叫稀缺。',
    },
    M12: {
      needs: ['belong'], drives: ['lust', 'gluttony', 'wrath'],
      why: '流量买的是注意力，注意力由情绪驱动。愤怒、欲望、猎奇是最省力的三种情绪——因为它们不需要理由。',
    },
    M13: {
      needs: ['survive'], drives: ['greed'],
      why: '薄利多销的本质是「用确定性换利润率」。消费者要的不是便宜，是「不会亏」；规模方的定价权来自「我比你更能扛」。',
    },
    M14: {
      needs: ['autonomy'], drives: ['greed', 'fear'],
      why: '风口卖的是「我没错过」。人对错过的恐惧，往往大于对亏损的恐惧——FOMO 就是靠这个收钱的。',
    },
    M15: {
      needs: ['safety'], drives: ['greed', 'fear'],
      why: '钱生钱是唯一「不用出卖时间」的路径，所以它对所有人都致命。风险被系统性低估，因为贪婪总比恐惧先到场。',
    },
    M16: {
      needs: ['meaning', 'esteem'], drives: ['achieve'],
      why: '这条不是卖给别人，是卖给自己。人和人的差距不在想法，在「想完之后有没有动」——所以它的回报不是钱，是「我居然做成了」。',
    },
  },
};
