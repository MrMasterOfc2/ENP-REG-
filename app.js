const STORAGE={students:"enp_students_v1",attendance:"enp_attendance_v1",examResults:"enp_exam_results_v1",receipts:"enp_receipts_v1"};
const EXAM_MODULES=[{key:"windows",name:"Windows",tests:["final"]},{key:"word",name:"Word",tests:["mid","final"]},{key:"excel",name:"Excel",tests:["mid","final"]},{key:"powerpoint",name:"PowerPoint",tests:["final"]},{key:"access",name:"Access",tests:["mid","final"]}];
const $=s=>document.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
const money=n=>"Rs. "+Number(n||0).toLocaleString("en-US");
const initials=name=>String(name||"ST").split(" ").filter(Boolean).slice(0,2).map(x=>x[0]).join("").toUpperCase();
const idEnding=id=>String(id||"").split(/[/-]/).filter(Boolean).at(-1)||String(id||"");
const classDayForDate=date=>date?["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][new Date(`${date}T00:00:00`).getDay()]:"";
const formatDate=date=>{
  if(!date)return"-";
  const parsed=new Date(`${String(date).slice(0,10)}T00:00:00`);
  return Number.isNaN(parsed.getTime())?"-":new Intl.DateTimeFormat("en-GB",{day:"2-digit",month:"short",year:"numeric"}).format(parsed);
};
const localDateKey=date=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
const currentMonthKey=()=>localDateKey(new Date()).slice(0,7);
let students=JSON.parse(localStorage.getItem(STORAGE.students)||"[]");
let attendance=JSON.parse(localStorage.getItem(STORAGE.attendance)||"{}");
let examResults=JSON.parse(localStorage.getItem(STORAGE.examResults)||"{}");
let receipts=JSON.parse(localStorage.getItem(STORAGE.receipts)||"[]");
let installPromptEvent=null;
let currentStudent=null;

function refreshData(){
  students=JSON.parse(localStorage.getItem(STORAGE.students)||"[]");
  attendance=JSON.parse(localStorage.getItem(STORAGE.attendance)||"{}");
  examResults=JSON.parse(localStorage.getItem(STORAGE.examResults)||"{}");
  receipts=JSON.parse(localStorage.getItem(STORAGE.receipts)||"[]");
}
function isExamMarked(value){return typeof value==="boolean"||value==="absent"}
function examGrade(correct,total){if(!total)return"N/A";const rate=correct/total*100;return rate>=75?"A":rate>=65?"B":rate>=55?"C":rate>=40?"S":"Fail"}
function examStats(result={}){let correct=0,completed=0,absent=0,total=0;EXAM_MODULES.forEach(module=>module.tests.forEach(test=>{for(let i=0;i<3;i++){total++;const value=result[module.key]?.[test]?.[i];if(isExamMarked(value)){completed++;if(value===true)correct++;if(value==="absent")absent++}}}));return{correct,completed,absent,total,rate:total?Math.round(correct/total*100):0,grade:examGrade(correct,total)}}
function moduleExamStats(result,module){let correct=0,completed=0,absent=0,total=module.tests.length*3;module.tests.forEach(test=>{for(let i=0;i<3;i++){const value=result[module.key]?.[test]?.[i];if(isExamMarked(value)){completed++;if(value===true)correct++;if(value==="absent")absent++}}});return{correct,completed,absent,total,rate:total?Math.round(correct/total*100):0,grade:examGrade(correct,total)}}
function attendanceRows(student){return Object.entries(attendance).flatMap(([key,marks])=>{const value=marks?.[student.id];if(value!=="present"&&value!=="absent")return[];const actual=key.startsWith("kid:")?key.slice(4):key;return[{key,actual,day:key.startsWith("kid:")?"Kid Course":classDayForDate(actual),value}]}).sort((a,b)=>b.actual.localeCompare(a.actual))}
function studentReceipts(student){return receipts.filter(r=>r.student?.id===student.id||r.studentId===student.id||r.student?.name===student.name).sort((a,b)=>String(b.createdAt||b.date||"").localeCompare(String(a.createdAt||a.date||"")))}
function whatsappNumber(phone){let n=String(phone||"").replace(/\D/g,"");if(n.startsWith("0"))n=`94${n.slice(1)}`;return n}
function studentPhone(student){return whatsappNumber(student?.guardian)||whatsappNumber(student?.phone)}
function findStudents(query){
  const q=String(query||"").trim().toLowerCase();
  if(!q)return[];
  return students.map(student=>{
    const id=String(student.id||"").toLowerCase();
    const end=idEnding(student.id).toLowerCase();
    const name=String(student.name||"").toLowerCase();
    const phone=String(student.phone||"").toLowerCase();
    const guardian=String(student.guardian||"").toLowerCase();
    const values=[id,end,name,phone,guardian];
    if(!values.some(v=>v.includes(q)))return null;
    const rank=id===q||end===q||name===q?0:name.startsWith(q)?1:id.startsWith(q)||end.startsWith(q)?2:name.includes(q)?3:4;
    return{student,rank};
  }).filter(Boolean).sort((a,b)=>a.rank-b.rank||a.student.name.localeCompare(b.student.name)).slice(0,8).map(item=>item.student);
}
function showMessage(text,type="error"){$("#lookupMessage").textContent=text;$("#lookupMessage").style.color=type==="ok"?"#d9fce9":"#ffd1d1"}
function renderProfileLines(student){
  $("#profileLines").innerHTML=[
    ["Student ID",student.id],
    ["Course",student.course],
    ["Class Day",student.group||"-"],
    ["Joined",student.joined||"-"],
    ["Student Phone",student.phone||"Not provided"],
    ["Guardian",student.guardian||"Not provided"]
  ].map(([label,value])=>`<div><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`).join("");
}
function monthlyClassDates(student,monthKey,rows){
  const [year,month]=String(monthKey||currentMonthKey()).split("-").map(Number);
  const dates=[];
  if(!year||!month)return dates;
  if(student.course==="Kid Course"||student.group==="Flexible"){
    const recorded=[...new Set(rows.filter(row=>row.actual.startsWith(`${year}-${String(month).padStart(2,"0")}`)).map(row=>row.actual))];
    return recorded.sort().map(key=>new Date(`${key}T00:00:00`));
  }
  const targetDay=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"].indexOf(student.group);
  const lastDay=new Date(year,month,0).getDate();
  for(let day=1;day<=lastDay;day++){
    const date=new Date(year,month-1,day);
    if(date.getDay()===targetDay)dates.push(date);
  }
  return dates;
}
function renderAbsentMiniCalendar(student,rows){
  const byDate=new Map(rows.map(row=>[row.actual,row.value]));
  const monthKey=$("#attendanceMonth").value||currentMonthKey();
  const days=monthlyClassDates(student,monthKey,rows).map(date=>{
    const key=localDateKey(date);
    return{key,day:date.getDate(),status:byDate.get(key)||"empty"};
  });
  $("#attendanceMonthNote").textContent=student.course==="Kid Course"||student.group==="Flexible"?"Marked Kid Course dates":`${student.group} class days`;
  $("#absentMiniCalendar").innerHTML=days.length?days.map(day=>`<span class="mini-day ${day.status}" title="${formatDate(day.key)} - ${day.status}">${day.day}</span>`).join(""):`<div class="mini-calendar-empty">No class dates found for this month</div>`;
}

function selectStudent(student){
  if(!student)return;
  currentStudent=student;
  const rows=attendanceRows(student);
  const present=rows.filter(r=>r.value==="present").length;
  const absent=rows.filter(r=>r.value==="absent").length;
  const total=present+absent;
  const due=Math.max(0,Number(student.fee||0)-Number(student.paid||0));
  const payRate=student.fee?Math.round(Number(student.paid||0)/Number(student.fee||1)*100):100;
  const examRecord=examResults[student.id]?.modules||{};
  const stats=student.course==="ICTT"?examStats(examRecord):null;
  const studentReceiptList=studentReceipts(student);
  $("#attendanceMonth").value=rows[0]?.actual?.slice(0,7)||$("#attendanceMonth").value||currentMonthKey();

  $("#resultWrap").classList.remove("hidden");
  $("#suggestions").innerHTML="";
  showMessage(`Showing summary for ${student.name}`,"ok");
  $("#studentAvatar").textContent=initials(student.name);
  $("#studentName").textContent=student.name;
  $("#studentMeta").textContent=`${student.id} | ${student.course} | ${student.phone||"No phone"}`;
  $("#presentCount").textContent=present;
  $("#absentCount").textContent=absent;
  $("#examRate").textContent=stats?`${stats.rate}%`:"N/A";
  $("#examDetail").textContent=stats?`${stats.correct} correct | ${stats.absent} absent | Grade ${stats.grade}`:"ICTT exam results only";
  $("#overallGrade").textContent=stats?stats.grade:"N/A";
  $("#paymentStatus").textContent=money(due);
  $("#paymentDetail").textContent=due?"Outstanding balance":"Payment complete";
  $("#classDay").textContent=student.group||"-";
  $("#joinedDate").textContent=`Joined ${student.joined||"-"}`;
  $("#totalFee").textContent=money(student.fee);
  $("#totalPaid").textContent=money(student.paid);
  $("#outstanding").textContent=money(due);
  $("#paymentProgress").style.width=`${Math.min(100,payRate)}%`;
  renderProfileLines(student);
  renderAbsentMiniCalendar(student,rows);

  $("#moduleList").innerHTML=stats?EXAM_MODULES.map(module=>{const ms=moduleExamStats(examRecord,module);return`<div class="module-row"><div><strong>${esc(module.name)}</strong><small>${ms.completed} / ${ms.total} marked | ${ms.absent} absent</small></div><span class="status grade">${ms.grade} | ${ms.rate}%</span></div>`}).join(""):`<div class="empty">No ICTT exam module records for this student</div>`;
  $("#receiptList").innerHTML=studentReceiptList.length?studentReceiptList.slice(0,8).map((receipt,index)=>`<div class="receipt-row"><div><strong>Receipt ${esc(receipt.no||receipt.id||`#${index+1}`)}</strong><small>${formatDate(receipt.createdAt||receipt.date)} | ${esc(receipt.method||"Payment")} | ${esc(receipt.student?.course||student.course)}</small></div><span class="status paid">${money(receipt.payment||receipt.amount)}</span></div>`).join(""):`<div class="empty">No payment receipts found</div>`;
  $("#resultWrap").scrollIntoView({behavior:"smooth",block:"start"});
}

function renderSuggestions(matches){$("#suggestions").innerHTML=matches.map(s=>`<button type="button" data-student-id="${esc(s.id)}"><strong>${esc(s.name)}</strong><small>${esc(s.id)} | ${esc(s.course||"-")} | ${esc(s.phone||"No phone")}</small></button>`).join("")}

$("#lookupForm").addEventListener("submit",e=>{
  e.preventDefault();
  refreshData();
  const q=$("#lookupInput").value.trim();
  const matches=findStudents(q);
  if(!students.length)return showMessage("No student data found yet. Please contact the institute office.");
  if(!matches.length)return showMessage("No matching student found. Check your ID or name.");
  const exact=matches.find(s=>s.id.toLowerCase()===q.toLowerCase()||idEnding(s.id).toLowerCase()===q.toLowerCase()||s.name.toLowerCase()===q.toLowerCase());
  if(exact||matches.length===1)selectStudent(exact||matches[0]);
  else{showMessage("Multiple students found. Select your record.","ok");renderSuggestions(matches)}
});

$("#lookupInput").addEventListener("input",e=>{
  refreshData();
  const q=e.target.value.trim();
  if(q.length<2){
    $("#suggestions").innerHTML="";
    return;
  }
  const matches=findStudents(q);
  if(matches.length>1){
    showMessage("Similar students found. Select the correct record.","ok");
    renderSuggestions(matches);
  }else if(matches.length===1){
    showMessage("One matching student found. Press Search or select below.","ok");
    renderSuggestions(matches);
  }else{
    $("#suggestions").innerHTML="";
    showMessage("");
  }
});

document.addEventListener("click",e=>{
  const button=e.target.closest("[data-student-id]");
  if(button){
    const student=students.find(s=>s.id===button.dataset.studentId);
    if(student)$("#lookupInput").value=student.name;
    selectStudent(student);
  }
});

$("#attendanceMonth").addEventListener("change",()=>{
  if(currentStudent)renderAbsentMiniCalendar(currentStudent,attendanceRows(currentStudent));
});

$("#printSummary").addEventListener("click",()=>window.print());
$("#copyStudentId").addEventListener("click",async()=>{
  if(!currentStudent)return showMessage("Search a student first.");
  try{
    await navigator.clipboard.writeText(currentStudent.id);
    showMessage(`Copied ${currentStudent.id}`,"ok");
  }catch{
    showMessage(currentStudent.id,"ok");
  }
});
$("#shareWhatsapp").addEventListener("click",()=>{
  if(!currentStudent)return showMessage("Search a student first.");
  const rows=attendanceRows(currentStudent);
  const present=rows.filter(r=>r.value==="present").length;
  const absent=rows.filter(r=>r.value==="absent").length;
  const total=rows.length;
  const rate=total?Math.round(present/total*100):0;
  const due=Math.max(0,Number(currentStudent.fee||0)-Number(currentStudent.paid||0));
  const payRate=currentStudent.fee?Math.round(Number(currentStudent.paid||0)/Number(currentStudent.fee||1)*100):100;
  const examRecord=examResults[currentStudent.id]?.modules||{};
  const stats=currentStudent.course==="ICTT"?examStats(examRecord):null;
  const phone=studentPhone(currentStudent);
  const monthKey=$("#attendanceMonth").value||currentMonthKey();
  const monthRows=rows.filter(row=>row.actual.startsWith(monthKey));
  const monthPresent=monthRows.filter(row=>row.value==="present").length;
  const monthAbsent=monthRows.filter(row=>row.value==="absent").length;
  const monthLabel=new Intl.DateTimeFormat("en-GB",{month:"long",year:"numeric"}).format(new Date(`${monthKey}-01T00:00:00`));
  const text=[
    "🎓 *E nena Piyasa - Student Summary*",
    "",
    "👤 *Student Details*",
    `• Name: ${currentStudent.name}`,
    `• Student ID: ${currentStudent.id}`,
    `• Course: ${currentStudent.course}`,
    `• Class Day: ${currentStudent.group||"-"}`,
    `• Joined Date: ${currentStudent.joined||"-"}`,
    `• Student Phone: ${currentStudent.phone||"Not provided"}`,
    `• Guardian Phone: ${currentStudent.guardian||"Not provided"}`,
    "",
    "📅 *Attendance Summary*",
    `• Overall Rate: ${rate}%`,
    `• Present Days: ${present}`,
    `• Absent Days: ${absent}`,
    `• Total Marked Days: ${total}`,
    `• ${monthLabel}: ${monthPresent} present / ${monthAbsent} absent`,
    "",
    "📝 *Exam Summary*",
    stats?`• Score: ${stats.rate}%\n• Grade: ${stats.grade}\n• Correct: ${stats.correct}/${stats.total}\n• Exam Absent Items: ${stats.absent}`:"• ICTT exam results only / Not available",
    "",
    "💳 *Payment Summary*",
    `• Total Fee: ${money(currentStudent.fee)}`,
    `• Total Paid: ${money(currentStudent.paid)}`,
    `• Outstanding: ${money(due)}`,
    `• Payment Progress: ${payRate}%`,
    "",
    "✅ Please open the Student Portal for the full report."
  ].join("\n");
  if(!phone)return showMessage("WhatsApp number not found for this student.");
  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`,"_blank");
});
$("#newSearch").addEventListener("click",()=>{
  $("#lookupInput").value="";
  $("#suggestions").innerHTML="";
  $("#resultWrap").classList.add("hidden");
  currentStudent=null;
  showMessage("Enter a student ID or name to search again.","ok");
  $("#lookupInput").focus();
});

function refreshSelectedStudent(){
  const selectedId=currentStudent?.id;
  refreshData();
  if(selectedId){
    const updated=students.find(student=>student.id===selectedId);
    if(updated)selectStudent(updated);
  }
}

window.addEventListener("enp:remote-data",refreshSelectedStudent);
window.addEventListener("enp:storage-data",refreshSelectedStudent);

if("serviceWorker" in navigator&&location.protocol!=="file:"){
  window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
}

window.addEventListener("beforeinstallprompt",event=>{
  event.preventDefault();
  installPromptEvent=event;
  $("#installApp").classList.remove("hidden");
});

$("#installApp").addEventListener("click",async()=>{
  if(!installPromptEvent)return;
  installPromptEvent.prompt();
  await installPromptEvent.userChoice;
  installPromptEvent=null;
  $("#installApp").classList.add("hidden");
});

window.addEventListener("appinstalled",()=>{
  installPromptEvent=null;
  $("#installApp").classList.add("hidden");
});

if(window.matchMedia("(display-mode: standalone)").matches){
  $("#installApp").classList.add("hidden");
}
