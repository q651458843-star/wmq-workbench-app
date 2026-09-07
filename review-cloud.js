(function(){
  const STORAGE_KEY='wmq_review_cloud';
  const DEFAULT_URL='https://xoujpvlwvikkxbxqpupr.supabase.co';
  const DEFAULT_PUBLISHABLE_KEY='sb_publishable_zYBIcmMDjUU7KoTBHPacHA_2bP0ZDIC';
  const read=()=>{try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}')}catch(error){return {}}};
  const clean=value=>String(value||'').trim();
  const normalized=config=>({
    supabaseUrl:(clean(config?.supabaseUrl)||DEFAULT_URL).replace(/\/+$/,''),
    supabaseAnonKey:clean(config?.supabaseAnonKey)||DEFAULT_PUBLISHABLE_KEY,
    workspaceId:clean(config?.workspaceId)||'wmq-team',
    workspaceKey:clean(config?.workspaceKey),
    displayName:clean(config?.displayName)||'团队成员'
  });
  const configured=config=>{const value=normalized(config||read());return /^https:\/\/.+\.supabase\.co$/i.test(value.supabaseUrl)&&Boolean(value.supabaseAnonKey&&value.workspaceId&&value.workspaceKey)};
  async function request(path,{method='GET',body,prefer}={}){
    const config=normalized(read());
    if(!configured(config))throw new Error('请先连接团队云端');
    const headers={apikey:config.supabaseAnonKey,Authorization:`Bearer ${config.supabaseAnonKey}`,'x-workspace-key':config.workspaceKey};
    if(body!==undefined)headers['content-type']='application/json';
    if(prefer)headers.Prefer=prefer;
    const response=await fetch(`${config.supabaseUrl}/rest/v1/${path}`,{method,headers,body:body===undefined?undefined:JSON.stringify(body),cache:'no-store'});
    const text=await response.text();let data=null;try{data=text?JSON.parse(text):null}catch(error){data=text}
    if(!response.ok)throw new Error(data?.message||data?.hint||`云端请求失败（${response.status}）`);
    return data;
  }
  const encode=value=>encodeURIComponent(String(value));
  window.ReviewCloud={
    getConfig:()=>normalized(read()),
    saveConfig:config=>{const value=normalized(config);localStorage.setItem(STORAGE_KEY,JSON.stringify(value));return value},
    clearConfig:()=>localStorage.removeItem(STORAGE_KEY),
    isConfigured:()=>configured(read()),
    async list(){const config=normalized(read());return request(`review_posts?workspace_id=eq.${encode(config.workspaceId)}&select=*&order=published_at.desc,created_at.desc`)},
    async upsert(rows){return request('review_posts?on_conflict=workspace_id,client_id',{method:'POST',body:rows,prefer:'resolution=merge-duplicates,return=representation'})},
    async remove(id){const config=normalized(read());return request(`review_posts?workspace_id=eq.${encode(config.workspaceId)}&id=eq.${encode(id)}`,{method:'DELETE',prefer:'return=minimal'})},
    async test(){const config=normalized(read());const allowed=await request('rpc/review_workspace_access',{method:'POST',body:{target_workspace:config.workspaceId}});if(allowed!==true)throw new Error('团队工作区或团队密码不正确');return true}
  };
})();
