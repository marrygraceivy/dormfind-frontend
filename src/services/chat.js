let initializeApp,getApps,getAuth,signInWithCustomToken,signOut,getDatabase,ref,push,onValue,query,limitToLast,orderByChild,serverTimestamp,set;
import {api} from './api';
let auth,db,connecting;
export async function connectChat(config){
 if(auth?.currentUser&&db)return;
 if(connecting)return connecting;
 connecting=(async()=>{
  if(!config?.apiKey||!config?.databaseURL)throw new Error('Firebase chat needs the project settings in the backend .env.');
  ({initializeApp,getApps}=await import('firebase/app'));
  ({getAuth,signInWithCustomToken,signOut}=await import('firebase/auth'));
  ({getDatabase,ref,push,onValue,query,limitToLast,orderByChild,serverTimestamp,set}=await import('firebase/database'));
  const app=getApps()[0]||initializeApp(config);auth=getAuth(app);db=getDatabase(app);
  if(!auth.currentUser){const {token}=await api('/chat/token',{method:'POST',body:{}});await signInWithCustomToken(auth,token);}
 })();
 try{await connecting;}finally{connecting=null;}
}
export function chatPath(user,peer){const ids=[Number(user),Number(peer)].sort((a,b)=>a-b); return `direct/${ids[0]}/${ids[1]}/messages`;}
export function listenMessages(user,peer,receive,onError){
 return onValue(query(ref(db,chatPath(user,peer)),orderByChild('createdAt'),limitToLast(100)),s=>receive(Object.entries(s.val() || {}).map(([id,m])=>({id,...m}))),onError);
}
const readPath=(user,peer)=>`reads/${user}/${peer}`;
export function listenUnreadMessages(user,contacts,receive,onError){
 const states=new Map(),unsubscribe=[];
 const emit=()=>{const byPeer={};let total=0;for(const [peer,state] of states.entries()){const count=state.messages.filter(message=>String(message.sender)!==String(user)&&Number(message.createdAt||0)>Number(state.lastRead||0)).length;byPeer[peer]=count;total+=count;}receive({total,byPeer});};
 for(const contact of contacts){const peer=String(contact.user_id),state={messages:[],lastRead:0};states.set(peer,state);unsubscribe.push(onValue(query(ref(db,chatPath(user,peer)),orderByChild('createdAt'),limitToLast(100)),snapshot=>{state.messages=Object.entries(snapshot.val()||{}).map(([id,message])=>({id,...message}));emit();},onError));unsubscribe.push(onValue(ref(db,readPath(user,peer)),snapshot=>{state.lastRead=Number(snapshot.val()||0);emit();},onError));}
 emit();return()=>unsubscribe.forEach(stop=>stop());
}
export async function markMessagesRead(user,peer){if(db&&user&&peer)await set(ref(db,readPath(user,peer)),serverTimestamp());}
export async function sendMessage(user,peer,text){const body=text.trim();if(!body || body.length>2000) throw new Error('Use 1–2,000 characters.');await push(ref(db,chatPath(user,peer)),{sender:String(user),text:body,createdAt:serverTimestamp()});}
export async function disconnectChat(){connecting=null;if(auth?.currentUser)await signOut(auth);}
