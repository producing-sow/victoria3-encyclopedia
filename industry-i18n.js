// Module-local UI wording; game terms come from the MOD's own English localization.
if(window.V3I18n?.language==='en')Object.assign(window.V3_UI_EN,{
 '建筑数据版本':'Building dataset',
 '选择原版或 MOD':'Choose base game or MOD',
 '工业之链 MOD':'Chains of Industry MOD',
 '基于游戏':'Based on game',
 '适配':'Compatible with',
 '座建筑':'buildings',
 '种商品':'goods',
 '个生产方式':'production methods',
 '生产方式自带的商品百分比修正已计入产值。':'Goods percentage modifiers from production methods are included in output values.',
 '以下展示各单项生产方式自身的商品与用工量。百分比修正会作用于整组组合，请以上方建筑合计为准；单项净值不可直接相加。':'Each entry shows that method’s own goods and employment. Percentage modifiers apply across the entire combination; use the building totals above. Individual net values cannot simply be added together.',
 '单项基础净值':'Standalone base net value',
 '作用于整组组合的百分比修正（已计入建筑合计）：':'Percentage modifiers applied to the full combination (included in building totals): ',
 '读取原版与工业之链 MOD 合并后的定义，包括 MOD 新增、覆盖及追加内容；不包含其他 MOD 或存档修正。':'Merged base-game and Chains of Industry definitions, including new, replaced and injected content. Other MODs and save-game modifiers are excluded.',
 '读取安装目录原版文件，不合并 MOD 或存档修正。':'Base-game installation definitions; MODs and save-game modifiers are excluded.',
 'MOD 百分比修正':'MOD percentage modifiers',
 '先合计各生产方式的商品数量，再乘以（1＋同种商品投入或产出修正之和）与（1＋组合内吞吐量修正之和）。这些生产方式自带修正已计入建筑合计；不额外叠加科技、法律、州或国家的运行时效果。':'Goods quantities are summed first, then multiplied by (1 + the sum of that good’s input or output modifiers) and (1 + the sum of throughput modifiers in the combination). These inherent production-method modifiers are included; runtime technology, law, state and country effects are excluded.',
 'MOD 路径':'MOD path'
});
