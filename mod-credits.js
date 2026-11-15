/* Credits verified against the original Steam Workshop pages on 2026-11-15.
   Keep attribution independent of extracted game data so rebuilds retain it. */
(()=>{
 const workshop=id=>'https://steamcommunity.com/sharedfiles/filedetails/?id='+id;
 const records={
  'industrial-chain':{name:'Chains of Industry',id:'3723966801',authors:['活宝whw'],chinese:'builtin'},
  'more-companies':{name:'More Unique Companies',id:'3032185644',authors:['Coutin','flardarmar','W4RPER','EBTX_'],chinese:{name:'牛奶汉化-公司扩展',id:'3086429193',authors:['牛奶大魔王'],support:['花火']}},
  'real-resources':{name:'Explorable Real-World Resources',id:'3459869359',authors:['Asuna'],chinese:'builtin'}
 };
 const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const people=names=>names.map(name=>`<strong translate="no">${escape(name)}</strong>`).join(' / ');
 const link=(id,name)=>`<a href="${workshop(id)}" target="_blank" rel="noopener noreferrer"><span translate="no">${escape(name)}</span> ↗</a>`;
 function markup(key){
  const record=records[key];if(!record)return '';
  const en=window.V3I18n?.language==='en',chinese=record.chinese;
  return `<div class="mod-credit-block" aria-label="${en?'MOD sources and credits':'MOD 来源与署名'}"><div>${en?'MOD source: ':'MOD 来源：'}${link(record.id,record.name)} <small>Steam Workshop · ${record.id}</small></div><div>${en?'MOD author: ':'MOD 作者：'}${people(record.authors)}</div>${chinese==='builtin'?`<div>${en?'Chinese localization: Simplified Chinese included in the original MOD.':'汉化支持：MOD 本体自带简体中文。'}</div>`:`<div>${en?'Chinese localization: ':'汉化来源：'}${link(chinese.id,chinese.name)}</div><div>${en?'Chinese localization author: ':'汉化作者：'}${people(chinese.authors)}${chinese.support.length?` · ${en?'Translation support: ':'汉化支持：'}${people(chinese.support)}`:''}</div>`}<p>${en?'MOD content and translations are credited to their respective creators. This encyclopedia extracts data and provides browsing and comparison.':'MOD 内容与汉化由相应作者制作；本百科提供数据提取、整理与查询展示。'}</p></div>`;
 }
 window.V3ModCredits={records,markup};
})();
