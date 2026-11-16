const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
// A single stack lets ink and transparent images be arranged in any order.
export class Board {
  constructor(canvas,changed){
    Object.assign(this,{canvas,ctx:canvas.getContext('2d'),changed,elements:[],history:[],events:[],revision:0,color:'#14244B',tool:'pen',selectedId:null,lastSize:{width:900,height:400}});
    canvas.tabIndex=0;
    canvas.addEventListener('pointerdown',e=>this.down(e));canvas.addEventListener('pointermove',e=>this.move(e));
    canvas.addEventListener('pointerup',()=>this.up());canvas.addEventListener('pointercancel',()=>this.up());canvas.addEventListener('keydown',e=>this.key(e));
    this.observer=new ResizeObserver(()=>this.render());this.observer.observe(canvas);
  }
  get strokes(){return this.elements.filter(e=>e.kind==='stroke');}
  get images(){return this.elements.filter(e=>e.kind==='image');}
  get selected(){return this.elements.find(e=>e.id===this.selectedId&&e.kind==='image');}
  get hasContent(){return this.elements.length>0;}
  size(){const r=this.canvas.getBoundingClientRect();if(r.width>0&&r.height>0)this.lastSize={width:r.width,height:r.height};return this.lastSize;}
  bounds(item){const {width,height}=this.size();const w=Math.min(item.w,1,item.aspect*height/width),h=w*width/item.aspect/height;return {x:clamp(item.x,0,1-w),y:clamp(item.y,0,1-h),w,h};}
  point(e){const r=this.canvas.getBoundingClientRect();return [(e.clientX-r.left)/r.width,(e.clientY-r.top)/r.height,Date.now()];}
  remember(){this.history.push({elements:this.elements.map(e=>e.kind==='image'?{...e}:{...e,points:e.points.map(p=>[...p])}),selectedId:this.selectedId});if(this.history.length>40)this.history.shift();}
  commit(type,id){this.events.push({type,id,at:Date.now()});this.revision++;this.render();this.changed();}
  select(id){this.selectedId=id;this.render();this.onSelection?.();}
  setTool(tool){this.tool=tool;if(tool!=='select')this.select(null);this.render();}
  hitImage(point){
    for(const image of [...this.images].reverse()){
      const b=this.bounds(image),u=(point[0]-b.x)/b.w,v=(point[1]-b.y)/b.h;
      if(u<0||u>1||v<0||v>1)continue;const mask=image.mask;
      if(!mask||mask.data[(Math.min(mask.height-1,Math.floor(v*mask.height))*mask.width+Math.min(mask.width-1,Math.floor(u*mask.width)))*4+3]>24)return image;
    }return null;
  }
  onHandle(point){const image=this.selected;if(!image)return false;const b=this.bounds(image),s=this.size();return Math.abs(point[0]-b.x-b.w)*s.width<13&&Math.abs(point[1]-b.y-b.h)*s.height<13;}
  down(e){
    if(e.button!==0)return;e.preventDefault();this.canvas.focus({preventScroll:true});this.canvas.setPointerCapture(e.pointerId);const point=this.point(e);
    if(this.tool==='select'){
      const resize=this.onHandle(point),image=resize?this.selected:this.hitImage(point);this.select(image?.id||null);if(!image)return;
      this.remember();this.current={kind:resize?'resize':'move',id:image.id,start:point,bounds:this.bounds(image),dirty:false};this.canvas.style.cursor=resize?'nwse-resize':'grabbing';return;
    }
    this.remember();if(this.tool==='eraser'){this.current={kind:'erase',dirty:false};this.eraseAt(point);return;}
    const stroke={kind:'stroke',id:crypto.randomUUID(),color:this.color,at:Date.now(),points:[point]};this.elements.push(stroke);this.current={kind:'draw',stroke,dirty:true};this.render();
  }
  move(e){
    const point=this.point(e);
    if(!this.current){this.canvas.style.cursor=this.tool==='select'?(this.onHandle(point)?'nwse-resize':this.hitImage(point)?'grab':'default'):'crosshair';return;}
    if(this.current.kind==='draw'){this.current.stroke.points.push(point);this.render();return;}
    if(this.current.kind==='erase'){this.eraseAt(point);return;}
    const image=this.selected;if(!image)return;const {width,height}=this.size(),c=this.current,b=c.bounds;
    if(c.kind==='move'){image.x=clamp(b.x+point[0]-c.start[0],0,1-b.w);image.y=clamp(b.y+point[1]-c.start[1],0,1-b.h);}
    else{const dx=point[0]-b.x,dy=(point[1]-b.y)*height/width*image.aspect,proposed=Math.abs(dx-b.w)>Math.abs(dy-b.w)?dx:dy;image.w=clamp(proposed,Math.min(40/width,b.w),Math.min(1-b.x,(1-b.y)*height/width*image.aspect));image.x=b.x;image.y=b.y;}
    c.dirty=true;this.render();
  }
  eraseAt(point){
    const s=this.size(),radius=14;
    const remaining=this.elements.filter(item=>item.kind!=='stroke'||!item.points.some((p,i)=>{
      const a=i?item.points[i-1]:p,px=point[0]*s.width,py=point[1]*s.height,ax=a[0]*s.width,ay=a[1]*s.height,bx=p[0]*s.width,by=p[1]*s.height,dx=bx-ax,dy=by-ay;
      const t=clamp(((px-ax)*dx+(py-ay)*dy)/(dx*dx+dy*dy||1),0,1);return Math.hypot(px-ax-t*dx,py-ay-t*dy)<radius;
    }));
    if(remaining.length!==this.elements.length){this.elements=remaining;this.current.dirty=true;this.render();}
  }
  up(){if(!this.current)return;const c=this.current;this.current=null;if(c.dirty)this.commit(c.kind,c.id||c.stroke?.id);else this.history.pop();this.canvas.style.cursor=this.tool==='select'?'grab':'crosshair';this.onSelection?.();}
  addImage(image,name,mask,position){
    if(this.current)this.up();this.remember();const {width,height}=this.size(),aspect=image.width/image.height,w=Math.min(.28,.42*height/width*aspect),h=w*width/aspect/height,index=this.images.length;
    const item={kind:'image',id:crypto.randomUUID(),image,mask,name:name.slice(0,120),aspect,w,x:clamp((position?.[0]??(.18+(index%3)*.32))-w/2,0,1-w),y:clamp((position?.[1]??(.26+(Math.floor(index/3)%2)*.48))-h/2,0,1-h),at:Date.now()};
    this.elements.push(item);this.tool='select';this.selectedId=item.id;this.commit('image-add',item.id);this.onSelection?.();return item;
  }
  deleteSelected(){const image=this.selected;if(!image)return;this.remember();this.elements=this.elements.filter(e=>e.id!==image.id);this.selectedId=null;this.commit('image-delete',image.id);this.onSelection?.();}
  layer(direction){
    const image=this.selected;if(!image)return;const index=this.elements.indexOf(image),to=direction==='front'?this.elements.length-1:direction==='back'?0:clamp(index+(direction==='forward'?1:-1),0,this.elements.length-1);
    if(to===index)return;this.remember();this.elements.splice(index,1);this.elements.splice(to,0,image);this.commit('image-layer',image.id);this.onSelection?.();
  }
  undo(){if(this.current)this.up();const previous=this.history.pop();if(!previous)return;this.elements=previous.elements;this.selectedId=previous.selectedId;this.commit('undo');this.onSelection?.();}
  clear(){if(this.current)this.up();if(!this.hasContent)return;this.remember();this.elements=[];this.selectedId=null;this.commit('clear');this.onSelection?.();}
  reset(){this.elements=[];this.history=[];this.selectedId=null;this.current=null;this.events=[];this.revision++;this.render();this.changed();this.onSelection?.();}
  key(e){
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();this.undo();return;}
    if(e.key==='Escape'){this.select(null);return;}if(!this.selected)return;
    if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();this.deleteSelected();return;}
    if(e.key===']'||e.key==='['){e.preventDefault();this.layer(e.key===']'?'forward':'backward');return;}
    const delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];if(!delta)return;
    e.preventDefault();this.remember();const image=this.selected,b=this.bounds(image),s=this.size(),step=e.shiftKey?10:2;image.x=clamp(b.x+delta[0]*step/s.width,0,1-b.w);image.y=clamp(b.y+delta[1]*step/s.height,0,1-b.h);this.commit('image-move',image.id);
  }
  paint(ctx,width,height,recency=false){
    ctx.fillStyle='#ffffff';ctx.fillRect(0,0,width,height);
    for(const item of this.elements){
      if(item.kind==='image'){const b=this.bounds(item);ctx.drawImage(item.image,b.x*width,b.y*height,b.w*width,b.h*height);continue;}
      ctx.strokeStyle=recency?(Date.now()-item.at<15000?'#6d28d9':'#14244B'):item.color;ctx.lineWidth=3;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();const [first,...rest]=item.points;ctx.moveTo(first[0]*width,first[1]*height);if(!rest.length)ctx.lineTo(first[0]*width+.1,first[1]*height+.1);for(const p of rest)ctx.lineTo(p[0]*width,p[1]*height);ctx.stroke();
    }
  }
  render(){
    const actual=this.canvas.getBoundingClientRect();if(!actual.width||!actual.height)return;const r=this.size(),dpr=window.devicePixelRatio||1;this.canvas.width=Math.round(r.width*dpr);this.canvas.height=Math.round(r.height*dpr);this.ctx.setTransform(dpr,0,0,dpr,0,0);this.paint(this.ctx,r.width,r.height);
    const image=this.selected;if(image){const b=this.bounds(image);this.ctx.strokeStyle='#244FE5';this.ctx.lineWidth=1.5;this.ctx.setLineDash([5,3]);this.ctx.strokeRect(b.x*r.width,b.y*r.height,b.w*r.width,b.h*r.height);this.ctx.setLineDash([]);this.ctx.fillStyle='#244FE5';this.ctx.fillRect((b.x+b.w)*r.width-5,(b.y+b.h)*r.height-5,10,10);}
  }
  snapshot(recency=false){const c=document.createElement('canvas'),r=this.size();c.width=960;c.height=Math.max(1,Math.round(960*r.height/r.width));this.paint(c.getContext('2d'),c.width,c.height,recency);return c.toDataURL('image/jpeg',.75);}
}
