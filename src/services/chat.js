let initializeApp,getApps,getAuth,signInWithCustomToken,signOut,getDatabase,ref,push,onValue,query,limitToLast,orderByChild,serverTimestamp;
import {api} from './api';
let auth,db;
export async function connectChat(config){
 if(!config.apiKey || !config.databaseURL) throw new Error('Firebase chat needs the project settings in the backend .env.');
 ({initializeApp,getApps}=await import('firebase/app'));
 ({getAuth,signInWithCustomToken,signOut}=await import('firebase/auth'));
 ({getDatabase,ref,push,onValue,query,limitToLast,orderByChild,serverTimestamp}=await import('firebase/database'));
 const app=getApps()[0] || initializeApp(config); auth=getAuth(app); db=getDatabase(app);
 const {token}=await api('/chat/token',{method:'POST',body:{}}); await signInWithCustomToken(auth,token);
}
export function chatPath(user,peer){const ids=[Number(user),Number(peer)].sort((a,b)=>a-b); return `direct/${ids[0]}/${ids[1]}/messages`;}
export function listenMessages(user,peer,receive,onError){
 return onValue(query(ref(db,chatPath(user,peer)),orderByChild('createdAt'),limitToLast(100)),s=>receive(Object.entries(s.val() || {}).map(([id,m])=>({id,...m}))),onError);
}
export async function sendMessage(user,peer,text){const body=text.trim();if(!body || body.length>2000) throw new Error('Use 1–2,000 characters.');await push(ref(db,chatPath(user,peer)),{sender:String(user),text:body,createdAt:serverTimestamp()});}
export async function disconnectChat(){if(auth) await signOut(auth);}
