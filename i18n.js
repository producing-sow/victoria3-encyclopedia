(()=>{
 const params=new URLSearchParams(location.search);let stored='zh';try{stored=localStorage.getItem('v3-language')||stored}catch{}
 const language=['en','zh'].includes(params.get('lang'))?params.get('lang'):stored==='en'?'en':'zh';
 document.documentElement.lang=language==='en'?'en':'zh-CN';
 const hasHan=s=>/[\u3400-\u9fff]/.test(s),escaped=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 let regex=null,dictionary=null;
 function translate(text){
  if(language!=='en'||typeof text!=='string'||!hasHan(text))return text;
  dictionary=window.V3_UI_EN||{};
  if(dictionary[text])return dictionary[text];
  const trimmed=text.trim();if(dictionary[trimmed])return text.replace(trimmed,dictionary[trimmed]);
  if(!regex){const keys=Object.keys(dictionary).filter(k=>hasHan(k)&&k.length>1).sort((a,b)=>b.length-a.length);regex=new RegExp(keys.map(escaped).join('|'),'g')}
  return text.replace(regex,k=>dictionary[k]).replace(/([\d,.]+)\s*亿/g,(_,n)=>Intl.NumberFormat('en',{notation:'compact',maximumFractionDigits:2}).format(Number(n.replaceAll(',',''))*1e8)).replace(/([\d,.]+)\s*万/g,(_,n)=>Intl.NumberFormat('en',{notation:'compact',maximumFractionDigits:2}).format(Number(n.replaceAll(',',''))*1e4)).replace(/[人营艘级岁条种支个年月日座州项须]/g,k=>dictionary[k]??k);
 }
 function translateData(data){if(language!=='en')return data;if(Array.isArray(data))return data.map(translateData);if(data&&typeof data==='object'){const result={};for(const [key,value] of Object.entries(data))result[key]=translateData(value);return result}return translate(data)}
 window.V3I18n={language,t:translate,translateData};
 if(language==='en')document.write('<script src="i18n-dictionary.js"></'+'script>');
 document.addEventListener('DOMContentLoaded',()=>{
  const host=document.querySelector('main');if(!host)return;
  const languageControl=document.createElement('label');languageControl.className='language-control';languageControl.innerHTML='<span>Language / 语言</span><select aria-label="Language / 语言"><option value="zh">简体中文</option><option value="en">English</option></select>';
  languageControl.querySelector('select').value=language;host.prepend(languageControl);
  languageControl.querySelector('select').onchange=e=>{const choice=e.target.value;try{localStorage.setItem('v3-language',choice)}catch{}const url=new URL(location.href);url.searchParams.set('lang',choice);location.href=url.href};
  if(language!=='en')return;
  const seen=new WeakMap();
  function visit(root){
   if(root.nodeType===3){if(root.parentElement?.closest('script,style,.language-control,[translate="no"]'))return;const value=root.nodeValue;if(seen.get(root)===value)return;const next=translate(value);seen.set(root,next);if(next!==value)root.nodeValue=next;return}
   if(root.nodeType!==1&&root!==document)return;
   if(root.nodeType===1&&root.matches('script,style,.language-control,[translate="no"]'))return;
   const elements=root===document?[document.documentElement,...document.querySelectorAll('*')]:[root,...root.querySelectorAll('*')];
   for(const el of elements){if(el.closest('script,style,.language-control,[translate="no"]'))continue;
    if(el.tagName==='OPTION'&&!el.hasAttribute('value'))el.setAttribute('value',el.value);
    for(const attr of ['title','placeholder','aria-label','alt'])if(el.hasAttribute(attr)){const value=el.getAttribute(attr),next=translate(value);if(next!==value)el.setAttribute(attr,next)}
    if(el.matches('a[href]')){const value=el.getAttribute('href');if(!value||value.startsWith('#')||/^(?:https?:|mailto:|javascript:)/i.test(value))continue;try{const u=new URL(value,location.href);if(/\.html$/.test(u.pathname)){u.searchParams.set('lang',language);el.setAttribute('href',u.href)}}catch{}}
   }
   const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node;while(node=walker.nextNode())visit(node);
  }
  visit(document);document.title=translate(document.title);
  const observer=new MutationObserver(records=>{for(const r of records){if(r.type==='characterData')visit(r.target);else for(const node of r.addedNodes)visit(node)}});
  observer.observe(document.body,{subtree:true,childList:true,characterData:true});
 });
})();


