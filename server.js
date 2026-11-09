const express=require('express');
const http=require('http');
const path=require('path');
const {Server}=require('socket.io');
const app=express();const server=http.createServer(app);const io=new Server(server,{cors:{origin:'*'}});const rooms=new Map();
app.use(express.static(path.join(__dirname,'public')));
app.get('/health',(_req,res)=>res.json({ok:true,service:'futbol-online'}));
function makeCode(){const c='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let s='';for(let i=0;i<6;i++)s+=c[Math.floor(Math.random()*c.length)];return s;}
function leaveRoom(socket){const code=socket.data.room;if(!code)return;const r=rooms.get(code);socket.leave(code);socket.data.room=null;if(!r)return;r.players.delete(socket.id);if(!r.players.size)rooms.delete(code);else io.to(code).emit('peer-left');}
io.on('connection',socket=>{
 socket.on('create-room',({mode,name}={})=>{leaveRoom(socket);let code;do{code=makeCode()}while(rooms.has(code));const r={code,mode:mode==='COOPERATIVO'?'COOPERATIVO':'1 VS 1',host:socket.id,players:new Map()};r.players.set(socket.id,String(name||'Jugador').slice(0,18));rooms.set(code,r);socket.data.room=code;socket.join(code);socket.emit('room-created',{code,mode:r.mode,count:1});});
 socket.on('join-room',({code,name}={})=>{const clean=String(code||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6);const r=rooms.get(clean);if(!r)return socket.emit('room-error',{message:'No existe una sala con ese código.'});if(r.players.size>=2)return socket.emit('room-error',{message:'La sala ya está completa.'});leaveRoom(socket);r.players.set(socket.id,String(name||'Jugador').slice(0,18));socket.data.room=clean;socket.join(clean);socket.emit('room-joined',{code:clean,mode:r.mode,count:r.players.size});io.to(clean).emit('room-status',{count:r.players.size,names:[...r.players.values()]});});
 socket.on('start-match',()=>{const code=socket.data.room,r=rooms.get(code);if(!r||r.host!==socket.id||r.players.size!==2)return;io.to(code).emit('start-match');});
 socket.on('guest-input',input=>{const code=socket.data.room,r=rooms.get(code);if(!r||r.host===socket.id||!input||typeof input!=='object')return;const clean={};if(Number.isFinite(input.x))clean.x=Math.max(-1,Math.min(1,input.x));if(Number.isFinite(input.y))clean.y=Math.max(-1,Math.min(1,input.y));if(typeof input.press==='boolean')clean.press=input.press;if(input.action&&['shoot','pass','through'].includes(input.action.type))clean.action={type:input.action.type,k:Math.max(0,Math.min(1,Number(input.action.k)||0)),curl:!!input.action.curl};io.to(r.host).emit('guest-input',clean);});
 socket.on('game-state',state=>{const code=socket.data.room,r=rooms.get(code);if(!r||r.host!==socket.id||!state||!Array.isArray(state.players)||state.players.length!==22)return;io.to(code).except(socket.id).emit('game-state',state);});
 socket.on('disconnect',()=>leaveRoom(socket));
});
const PORT=process.env.PORT||3000;server.listen(PORT,'0.0.0.0',()=>console.log('Servidor listo en puerto '+PORT));
