(function(){
  const keys={
    students:"enp_students_v1",
    attendance:"enp_attendance_v1",
    receipts:"enp_receipts_v1",
    examResults:"enp_exam_results_v1",
    finances:"enp_finances_v1",
    profile:"enp_profile_v1",
    pin:"enp_pin_v1",
    theme:"enp_theme_v1"
  };
  let suppress=false;
  let remoteReady=false;
  const channel=("BroadcastChannel" in window)?new BroadcastChannel("enp-realtime-sync"):null;
  const config=window.ENP_FIREBASE_CONFIG||{};

  function readLocal(){
    const read=(key,fallback)=>JSON.parse(localStorage.getItem(key)||fallback);
    return {
      students:read(keys.students,"[]"),
      attendance:read(keys.attendance,"{}"),
      receipts:read(keys.receipts,"[]"),
      examResults:read(keys.examResults,"{}"),
      finances:read(keys.finances,"{}"),
      profile:read(keys.profile,"null"),
      loginPin:localStorage.getItem(keys.pin)||"1234",
      theme:localStorage.getItem(keys.theme)||"light",
      updatedAt:new Date().toISOString()
    };
  }

  function writeLocal(data){
    if(!data)return;
    const localStudents=JSON.parse(localStorage.getItem(keys.students)||"[]");
    if(Array.isArray(data.students)&&data.students.length===0&&localStudents.length&&!data.updatedAt){
      window.enpSyncPush(readLocal());
      return;
    }
    suppress=true;
    if(Array.isArray(data.students))localStorage.setItem(keys.students,JSON.stringify(data.students));
    if(data.attendance&&typeof data.attendance==="object")localStorage.setItem(keys.attendance,JSON.stringify(data.attendance));
    if(Array.isArray(data.receipts))localStorage.setItem(keys.receipts,JSON.stringify(data.receipts));
    if(data.examResults&&typeof data.examResults==="object")localStorage.setItem(keys.examResults,JSON.stringify(data.examResults));
    if(data.finances&&typeof data.finances==="object")localStorage.setItem(keys.finances,JSON.stringify(data.finances));
    if(data.profile&&typeof data.profile==="object")localStorage.setItem(keys.profile,JSON.stringify(data.profile));
    if(data.loginPin)localStorage.setItem(keys.pin,data.loginPin);
    if(data.theme)localStorage.setItem(keys.theme,data.theme);
    suppress=false;
    window.dispatchEvent(new CustomEvent("enp:remote-data",{detail:data}));
    channel?.postMessage({type:"remote-data",data});
  }

  window.enpSyncPush=function(data){
    if(suppress)return;
    const payload={...(data||readLocal()),updatedAt:new Date().toISOString()};
    window.dispatchEvent(new CustomEvent("enp:local-data",{detail:payload}));
    window.dispatchEvent(new CustomEvent("enp:storage-data",{detail:payload}));
    channel?.postMessage({type:"local-data",data:payload});
    if(window.enpFirebaseSet&&remoteReady)window.enpFirebaseSet(payload);
  };

  channel?.addEventListener("message",event=>{
    const data=event.data?.data;
    if(!data)return;
    if(event.data.type==="local-data"){
      writeLocal(data);
      return;
    }
    if(event.data.type==="remote-data"){
      window.dispatchEvent(new CustomEvent("enp:remote-data",{detail:data}));
    }
  });

  window.addEventListener("storage",event=>{
    if(Object.values(keys).includes(event.key)){
      window.dispatchEvent(new CustomEvent("enp:storage-data",{detail:readLocal()}));
    }
  });

  if(!config.enabled)return;

  const appScript=document.createElement("script");
  appScript.src="https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js";
  appScript.onload=()=>{
    const dbScript=document.createElement("script");
    dbScript.src="https://www.gstatic.com/firebasejs/10.12.5/firebase-database-compat.js";
    dbScript.onload=()=>{
      try{
        firebase.initializeApp(config);
        const ref=firebase.database().ref("enp-system/main");
        remoteReady=true;
        window.enpFirebaseSet=data=>ref.set(data);
        ref.on("value",snapshot=>writeLocal(snapshot.val()));
        if(!localStorage.getItem("enp_firebase_seeded_v1")){
          ref.get().then(snapshot=>{
            if(!snapshot.exists())ref.set(readLocal());
            localStorage.setItem("enp_firebase_seeded_v1","1");
          });
        }
      }catch(error){
        console.warn("Firebase sync disabled:",error);
      }
    };
    document.head.appendChild(dbScript);
  };
  document.head.appendChild(appScript);
})();
