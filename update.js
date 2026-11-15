(()=>{
 const en=window.V3I18n?.language==='en',t=(zh,eng)=>en?eng:zh;
 document.querySelectorAll('[data-en]').forEach(el=>{el.textContent=en?el.dataset.en:el.dataset.zh});
 const input=document.querySelector('#game-root'),button=document.querySelector('#start-update'),status=document.querySelector('#update-status'),log=document.querySelector('#update-log'),progress=document.querySelector('#update-progress'),result=document.querySelector('#view-result'),connection=document.querySelector('#connection');
 const mode=document.querySelector('#update-mode'),modSettings=document.querySelector('#mod-settings'),discover=document.querySelector('#discover-mods');
 function setMods(mods){for(const key of ['industry','resources','companies']){const value=mods?.[key]||{};document.querySelector(`[data-path="${key}"]`).value=value.path||'';document.querySelector(`[data-mod="${key}"]`).checked=!!value.enabled}document.querySelector('#company-translation').value=mods?.companies?.translation||''}
 function getMods(){return Object.fromEntries(['industry','resources','companies'].map(key=>[key,{enabled:document.querySelector(`[data-mod="${key}"]`).checked,path:document.querySelector(`[data-path="${key}"]`).value,...(key==='companies'?{translation:document.querySelector('#company-translation').value}:{})}]))}
 mode.onchange=()=>{modSettings.hidden=mode.value==='vanilla';button.textContent=mode.value==='mods'?t('更新所选 MOD','Update selected MODs'):mode.value==='all'?t('更新原版和所选 MOD','Update vanilla and selected MODs'):t('更新整个百科','Update entire encyclopedia')};
 discover.onclick=async()=>{discover.disabled=true;try{const response=await fetch('/api/discover-mods',{method:'POST',headers:{'Content-Type':'application/json','X-Update-Token':token},body:JSON.stringify({root:input.value})});const data=await response.json();if(!response.ok)throw Error(data.error);const current=getMods();for(const [key,value] of Object.entries(data.mods)){if(value.path)current[key].path=value.path;if(value.translation)current[key].translation=value.translation}setMods(current);requestError='';status.textContent=t('已查找当前 Steam 库；未找到的 MOD 请手动填写。','Searched this Steam library. Enter any missing MOD paths manually.')}catch(error){requestError=error.message;status.textContent=requestError}finally{discover.disabled=false}};
 let token='',connected=false,posting=false,initialized=false,requestError='';
 const local=location.protocol==='http:'&&location.hostname==='127.0.0.1';
 function unavailable(){connected=false;button.disabled=true;discover.disabled=true;document.querySelector('#launcher-help').hidden=false;connection.textContent=t('未连接本地更新服务。','Local update service is not connected.');}
 async function poll(){
  try{
   const response=await fetch('/api/update',{cache:'no-store'});if(!response.ok)throw Error(response.status);
   const state=await response.json();token=state.token;connected=true;
   if(!initialized){input.value=state.root;setMods(state.mods);initialized=true}
   document.querySelector('#launcher-help').hidden=true;connection.textContent=t('本地更新服务已连接。','Local update service connected.');
   button.disabled=state.running||posting;input.disabled=state.running||posting;progress.hidden=!state.running;mode.disabled=state.running||posting;modSettings.disabled=state.running||posting;discover.disabled=state.running||posting;
   status.dataset.error=String(state.status==='error');
   const texts={idle:t('等待更新。','Ready to update.'),running:t('正在更新，请保留本地服务窗口。','Updating. Keep the local service window open.'),error:t('更新未完成，请查看日志；失败的部分保留原有数据。','Update incomplete. See the log; failed datasets were preserved.'),success:state.result?.mode==='all'?t('原版和所选 MOD 更新完成；只有原版变化会生成快照。','Vanilla and selected MODs updated; only vanilla changes create snapshots.'):state.result?.mode==='mods'?t('MOD 数据已更新，没有生成快照。','MOD data updated. No snapshots created.'):state.result?.snapshot?t('更新完成，已生成新的原版快照。','Update complete. A new vanilla snapshot was created.'):t('更新完成，原版数据未变化，没有创建重复快照。','Update complete. Vanilla data is unchanged; no duplicate snapshot created.')};
   status.textContent=requestError||texts[state.status];if(requestError)status.dataset.error='true';log.textContent=state.logs.join('\n');log.scrollTop=log.scrollHeight;result.hidden=state.status!=='success'||state.result?.mode==='mods';
  }catch{unavailable()}finally{setTimeout(poll,1200)}
 }
 document.querySelector('#update-form').addEventListener('submit',async event=>{
  event.preventDefault();if(!connected||posting)return;posting=true;requestError='';button.disabled=true;result.hidden=true;
  try{const response=await fetch('/api/update',{method:'POST',headers:{'Content-Type':'application/json','X-Update-Token':token},body:JSON.stringify({root:input.value,mode:mode.value,mods:getMods()})});const data=await response.json();if(!response.ok)throw Error(data.error);status.textContent=t('正在启动更新…','Starting update…');}
  catch(error){requestError=error.message;status.textContent=requestError;status.dataset.error='true'}
  finally{posting=false;button.disabled=false}
 });
 status.textContent=t('等待连接本地更新服务。','Waiting for the local update service.');
 if(local)poll();else unavailable();
})();
