import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Board} from '../public/board.js';
globalThis.ResizeObserver=class{observe(){}};
globalThis.window={devicePixelRatio:1};
function makeBoard(){
 let rect={left:0,top:0,width:1000,height:500};const calls=[];
 const ctx=new Proxy({drawImage:(...args)=>calls.push(args)},{get:(o,k)=>k in o?o[k]:()=>{}});
 const canvas={style:{},getContext:()=>ctx,getBoundingClientRect:()=>rect,addEventListener(){},setPointerCapture(){},focus(){}};
 let changes=0;const board=new Board(canvas,()=>changes++);
 return {board,calls,setRect:r=>rect=r,changes:()=>changes};
}
const image={width:400,height:200};
const pointer=(x,y)=>({button:0,clientX:x,clientY:y,pointerId:1,preventDefault(){}});
test('layering, deletion and undo preserve the image composition and ink',()=>{
 const {board}=makeBoard();const a=board.addImage(image,'CPU.png'),b=board.addImage(image,'RAM.png');
 board.elements.push({kind:'stroke',id:'ink',points:[[0,0],[1,1]],color:'#000',at:1});
 board.layer('back');assert.equal(board.elements[0].id,b.id);
 board.layer('front');assert.equal(board.elements.at(-1).id,b.id);
 board.deleteSelected();assert.equal(board.images.length,1);assert.equal(board.strokes.length,1);
 board.undo();assert.equal(board.selected.name,'RAM.png');assert.equal(board.images.length,2);assert.equal(board.elements.at(-1).id,b.id);
 board.undo();assert.equal(board.elements[0].id,b.id);assert.ok(board.elements.some(e=>e.id===a.id));
});
test('transparent case interior allows selecting a component below it',()=>{
 const {board}=makeBoard();const under=board.addImage(image,'Motherboard.png',undefined,[.5,.5]);
 board.addImage(image,'Case.png',{width:1,height:1,data:new Uint8ClampedArray([0,0,0,0])},[.5,.5]);
 const b=board.bounds(under);assert.equal(board.hitImage([b.x+b.w/2,b.y+b.h/2]).id,under.id);
});
test('a drag is one undoable move and resize keeps the original aspect ratio',()=>{
 const {board}=makeBoard();board.addImage(image,'SSD.png');const start={...board.bounds(board.selected)};
 board.down(pointer((start.x+start.w/2)*1000,(start.y+start.h/2)*500));board.move(pointer(900,400));board.up();
 assert.notEqual(board.selected.x,start.x);assert.ok(board.selected.x+board.bounds(board.selected).w<=1);
 board.undo();assert.equal(board.selected.x,start.x);
 const b=board.bounds(board.selected);board.down(pointer((b.x+b.w)*1000,(b.y+b.h)*500));board.move(pointer((b.x+b.w)*1000+50,(b.y+b.h)*500+25));board.up();
 const resized=board.bounds(board.selected);assert.ok(resized.w>b.w);assert.equal(Math.round(resized.w*1000/(resized.h*500)),2);
});
test('eraser removes ink while leaving images intact, and undo restores ink',()=>{
 const {board}=makeBoard();board.addImage(image,'CPU.png');board.setTool('pen');board.down(pointer(100,100));board.move(pointer(200,100));board.up();
 board.setTool('eraser');board.down(pointer(150,100));board.up();assert.equal(board.strokes.length,0);assert.equal(board.images.length,1);
 board.undo();assert.equal(board.strokes.length,1);
});
test('hidden drawing tab retains the snapshot aspect and excludes selection handles',()=>{
 const {board,setRect}=makeBoard();board.addImage(image,'CPU.png');let strokes=0,draws=0;
 const context=new Proxy({strokeRect:()=>strokes++,drawImage:()=>draws++},{get:(o,k)=>k in o?o[k]:()=>{}});
 let exported;globalThis.document={createElement:()=>exported={getContext:()=>context,toDataURL:()=> 'data:image/jpeg;base64,abc'}};
 setRect({left:0,top:0,width:0,height:0});board.snapshot();assert.equal(exported.width,960);assert.equal(exported.height,480);assert.equal(draws,1);assert.equal(strokes,0);
});
test('a new lesson clears images and their undo history',()=>{
 const {board}=makeBoard();board.addImage(image,'Case.png');board.reset();board.undo();assert.equal(board.hasContent,false);assert.equal(board.images.length,0);
});
test('batch imports initially occupy separate positions inside the board',()=>{
 const {board}=makeBoard();for(let i=0;i<6;i++)board.addImage(image,`part-${i}.png`);
 assert.equal(new Set(board.images.map(i=>`${i.x},${i.y}`)).size,6);
 for(const i of board.images){const b=board.bounds(i);assert.ok(b.x>=0&&b.y>=0&&b.x+b.w<=1&&b.y+b.h<=1);}
});
