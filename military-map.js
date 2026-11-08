(function(root){
  'use strict';
  root.createMilitaryMap=function({model,onSelect,getSelected,color,format}){
    const svg=document.querySelector('#military-map'),viewport=document.querySelector('#military-viewport'),tip=document.querySelector('#military-map-tooltip');
    const width=8192,height=3616,shapes=new Map();let view={x:0,y:0,w:width,h:height},drag=null,suppressClick=false;
    const fragment=document.createDocumentFragment();
    for(const country of model.countries){
      if(!country.path)continue;
      const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',country.path);path.setAttribute('class','military-country-shape');path.setAttribute('fill',color(country.id));path.setAttribute('tabindex','0');path.setAttribute('role','button');path.setAttribute('aria-label',`查看${country.name}军队`);path.dataset.country=country.id;
      const title=document.createElementNS('http://www.w3.org/2000/svg','title');title.textContent=`${country.name} · 陆军 ${model.totals[country.id].army} 营 / 海军 ${model.totals[country.id].fleet} 艘`;path.append(title);fragment.append(path);shapes.set(country.id,path);
    }
    document.querySelector('#military-countries').append(fragment);
    function apply(){view=root.V3_MILITARY.clampView(view,width,height);svg.setAttribute('viewBox',`${view.x} ${view.y} ${view.w} ${view.h}`);document.querySelector('#military-map-scale').textContent=(width/view.w).toFixed(1)+'×'}
    function fit(){view={x:0,y:0,w:width,h:height};apply()}
    function zoom(factor,point={x:view.x+view.w/2,y:view.y+view.h/2}){const w=Math.max(width/128,Math.min(width,view.w/factor)),r=w/view.w;view={x:point.x-(point.x-view.x)*r,y:point.y-(point.y-view.y)*r,w,h:view.h*r};apply()}
    function focus(){const b=model.countries.find(c=>c.id===getSelected())?.bounds;if(!b)return;const ratio=svg.clientWidth/svg.clientHeight,h=Math.max(b[3]*1.3,b[2]*1.3/ratio,90),w=h*ratio;view={x:b[0]+b[2]/2-w/2,y:b[1]+b[3]/2-h/2,w,h};apply()}
    function paint(){for(const [id,path] of shapes){const active=id===getSelected();path.classList.toggle('selected',active);path.setAttribute('aria-pressed',String(active))}const selected=shapes.get(getSelected());if(selected)selected.parentNode.append(selected)}
    svg.addEventListener('wheel',event=>{event.preventDefault();const point=svg.createSVGPoint();point.x=event.clientX;point.y=event.clientY;zoom(event.deltaY<0?1.2:1/1.2,point.matrixTransform(svg.getScreenCTM().inverse()));tip.hidden=true},{passive:false});
    svg.addEventListener('pointerdown',event=>{if(event.button!==0||drag)return;suppressClick=false;drag={id:event.pointerId,x:event.clientX,y:event.clientY,view:{...view},scale:svg.getScreenCTM().a,country:event.target.closest('[data-country]')?.dataset.country,moved:false};svg.setPointerCapture(event.pointerId);tip.hidden=true});
    svg.addEventListener('pointermove',event=>{
      if(drag){if(event.pointerId!==drag.id)return;const dx=event.clientX-drag.x,dy=event.clientY-drag.y;if(Math.hypot(dx,dy)>4)drag.moved=true;if(drag.moved){view={...drag.view,x:drag.view.x-dx/drag.scale,y:drag.view.y-dy/drag.scale};svg.classList.add('dragging');apply()}return}
      const id=event.target.closest('[data-country]')?.dataset.country,country=model.countries.find(c=>c.id===id);if(!country){tip.hidden=true;return}
      tip.textContent=`${country.name} · 陆军 ${format(model.totals[id].army)} 营 / 海军 ${format(model.totals[id].fleet)} 艘`;tip.hidden=false;
      const rect=viewport.getBoundingClientRect();tip.style.left=Math.max(5,Math.min(event.clientX-rect.left+12,rect.width-tip.offsetWidth-6))+'px';tip.style.top=Math.max(5,Math.min(event.clientY-rect.top+12,rect.height-tip.offsetHeight-6))+'px';
    });
    function end(event){if(!drag||drag.id!==event.pointerId)return;const country=event.type==='pointerup'&&!drag.moved?drag.country:null;suppressClick=true;drag=null;svg.classList.remove('dragging');if(svg.hasPointerCapture(event.pointerId))svg.releasePointerCapture(event.pointerId);if(country)onSelect(country)}
    svg.addEventListener('pointerup',end);svg.addEventListener('pointercancel',end);svg.addEventListener('lostpointercapture',end);svg.addEventListener('pointerleave',()=>tip.hidden=true);
    svg.addEventListener('click',event=>{if(suppressClick){suppressClick=false;return}const country=event.target.closest('[data-country]')?.dataset.country;if(country)onSelect(country)});
    svg.addEventListener('keydown',event=>{const country=event.target.closest('[data-country]')?.dataset.country;if(country&&['Enter',' '].includes(event.key)){event.preventDefault();onSelect(country);return}if(!['+','=','-','0','Home','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;event.preventDefault();if(['0','Home'].includes(event.key))fit();else if(event.key==='-')zoom(1/1.3);else if(['+','='].includes(event.key))zoom(1.3);else{view.x+=event.key==='ArrowLeft'?-view.w*.1:event.key==='ArrowRight'?view.w*.1:0;view.y+=event.key==='ArrowUp'?-view.h*.1:event.key==='ArrowDown'?view.h*.1:0;apply()}});
    document.querySelector('#military-zoom-in').onclick=()=>zoom(1.4);document.querySelector('#military-zoom-out').onclick=()=>zoom(1/1.4);document.querySelector('#military-fit').onclick=fit;document.querySelector('#military-focus').onclick=focus;apply();
    return {paint,focus};
  };
})(window);
