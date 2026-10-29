/** Read both the legacy atomic envelope and the per-record IndexedDB format. */
export const readEnvelope = page => page.evaluate(async () => {
 const db=await new Promise((resolve,reject)=>{const q=indexedDB.open('axis');q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});
 try{
  const value=await new Promise((resolve,reject)=>{const q=db.transaction('state').objectStore('state').get('cc:store');q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});
  if(!value)return null;
  const envelope=JSON.parse(value);
  if(envelope.recordsVersion===1){
   for(const name of ['games','analyses']){
    const rows=await new Promise((resolve,reject)=>{const q=db.transaction(name).objectStore(name).getAll();q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});
    envelope.state[name]=name==='games'?rows:Object.fromEntries(rows.map(row=>[row.id,row.value]));
   }
   delete envelope.recordsVersion;
  }
  return envelope;
 }finally{db.close();}
});
export const writeEnvelope = (page,saved) => page.evaluate(async saved=>{
 const db=await new Promise((resolve,reject)=>{const q=indexedDB.open('axis');q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});
 try{await new Promise((resolve,reject)=>{const tx=db.transaction('state','readwrite');tx.objectStore('state').put(JSON.stringify(saved),'cc:store');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}finally{db.close();}
},saved);
