// Native social-service block list, scoped to the selected Microsoft account.
// Local hiding is independent; a failed request must not erase a known list.
export const socialUuid=value=>{const s=String(value||'').replace(/-/g,'').toLowerCase();return /^[0-9a-f]{32}$/.test(s)&&!/^[0]+$/.test(s)?s.slice(0,8)+'-'+s.slice(8,12)+'-'+s.slice(12,16)+'-'+s.slice(16,20)+'-'+s.slice(20):null;};
export class SocialBlocking {
 constructor(game){this.game=game;this.accountId=null;this.generation=0;this.nextAttempt=0;this.loaded=false;this.privilegesLoaded=false;this.pending=null;this.error=null;game.blockedPlayers=new Set();game.accountPrivileges=null;}
 async sync(account=this.game.accounts.active(),now=Date.now()){
  const id=account?.type==='microsoft'?socialUuid(account.uuid):null;
  if(id!==this.accountId){this.accountId=id;this.generation++;this.nextAttempt=0;this.loaded=false;this.privilegesLoaded=false;this.pending=null;this.error=null;this.game.blockedPlayers=new Set();this.game.accountPrivileges=null;}
  if(!id)return;
  if((this.loaded&&this.privilegesLoaded)||now<this.nextAttempt)return this.pending;
  this.nextAttempt=now+120000;const generation=this.generation;
  const pending=Promise.resolve().then(async()=>{
   const accounts=this.game.accounts,fresh=accounts.ensureFresh?await accounts.ensureFresh(account):account;
   if(generation!==this.generation)return;
   this.error=null;
   if(!this.privilegesLoaded){
    if(!accounts.socialPrivileges)this.privilegesLoaded=true;
    else try{const privileges=await accounts.socialPrivileges(fresh);if(generation!==this.generation)return;this.game.accountPrivileges=privileges;this.privilegesLoaded=true;}catch(e){if(generation===this.generation)this.error=e.message;}
   }
   if(generation!==this.generation)return;
   if(!this.loaded){
    const profiles=await accounts.blockedProfiles(fresh);if(generation!==this.generation)return;
    const blocked=new Set();for(const uuid of profiles){const value=socialUuid(uuid);if(value)blocked.add(value);}
    this.game.blockedPlayers=blocked;this.loaded=true;
   }
  }).catch(e=>{if(generation===this.generation)this.error=e.message||'Account social service unavailable';}).finally(()=>{if(generation===this.generation)this.pending=null;});
  this.pending=pending;return pending;
 }
 isBlocked(uuid){const id=socialUuid(uuid);return !!id&&this.game.blockedPlayers.has(id);}
}
