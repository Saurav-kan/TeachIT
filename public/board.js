// Vector coordinates are normalized: resizing never destroys a drawing.
export class Board {
  constructor(canvas, changed) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.changed = changed;
    this.strokes = []; this.events = []; this.revision = 0; this.color = '#14244B'; this.tool = 'pen';
    canvas.addEventListener('pointerdown', e => this.down(e));
    canvas.addEventListener('pointermove', e => this.move(e));
    canvas.addEventListener('pointerup', () => this.up());
    canvas.addEventListener('pointercancel', () => this.up());
    this.observer = new ResizeObserver(() => this.render()); this.observer.observe(canvas);
  }
  point(e) { const r = this.canvas.getBoundingClientRect(); return [(e.clientX-r.left)/r.width, (e.clientY-r.top)/r.height, Date.now()]; }
  down(e) {
    if(e.button !== 0) return;
    this.canvas.setPointerCapture(e.pointerId);
    this.current = { id: crypto.randomUUID(), tool: this.tool, color: this.color, at: Date.now(), points: [this.point(e)] };
    this.strokes.push(this.current); this.render();
  }
  move(e) { if (!this.current) return; this.current.points.push(this.point(e)); this.render(); }
  up() {
    if(!this.current) return;
    this.events.push({ type: this.current.tool, id: this.current.id, at: this.current.at });
    this.current = null; this.revision++; this.changed(); this.render();
  }
  undo() { if(this.current || !this.strokes.length) return; const s=this.strokes.pop(); this.events.push({type:'undo', id:s.id, at:Date.now()}); this.revision++; this.changed(); this.render(); }
  clear() { if(!this.strokes.length) return; this.strokes=[]; this.current=null; this.events.push({type:'clear',at:Date.now()}); this.revision++; this.changed(); this.render(); }
  paint(ctx, width, height, recency=false) {
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,width,height);
    for(const s of this.strokes) {
      ctx.strokeStyle = s.tool==='eraser' ? '#ffffff' : recency ? (Date.now()-s.at < 15000 ? '#6d28d9' : '#14244B') : s.color;
      ctx.lineWidth = s.tool==='eraser' ? 24 : 3; ctx.lineCap='round'; ctx.lineJoin='round';
      ctx.beginPath(); const [first,...rest]=s.points; ctx.moveTo(first[0]*width,first[1]*height);
      if(!rest.length) ctx.lineTo(first[0]*width+0.1,first[1]*height+0.1);
      for(const p of rest) ctx.lineTo(p[0]*width,p[1]*height); ctx.stroke();
    }
  }
  render() {
    const r=this.canvas.getBoundingClientRect(); const dpr=window.devicePixelRatio||1;
    this.canvas.width=Math.round(r.width*dpr); this.canvas.height=Math.round(r.height*dpr);
    this.ctx.setTransform(dpr,0,0,dpr,0,0); this.paint(this.ctx,r.width,r.height);
  }
  snapshot(recency=false) { const c=document.createElement('canvas'); const r=this.canvas.getBoundingClientRect(); c.width=960; c.height=Math.max(1,Math.round(960*r.height/Math.max(1,r.width))); this.paint(c.getContext('2d'),c.width,c.height,recency); return c.toDataURL('image/jpeg',0.75); }
}
