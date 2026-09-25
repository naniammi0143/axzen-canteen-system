const test=require('node:test');
const assert=require('node:assert/strict');
const {normalizeCashPlanActivation}=require('../backend/cash-plan');

const plans=[{name:'Starter',offerPrice:'599',active:true},{name:'Growth',offerPrice:'₹799',active:true},{name:'Old',offerPrice:'100',active:false}];

test('cash plan activation requires confirmation and the exact plan amount',()=>{
  assert.throws(()=>normalizeCashPlanActivation({planName:'Starter',months:3,amount:1797},plans),/Confirm/);
  assert.throws(()=>normalizeCashPlanActivation({confirmCashReceived:true,planName:'Starter',months:3,amount:1700},plans),/exactly Rs 1797/);
  const result=normalizeCashPlanActivation({confirmCashReceived:true,planName:'Starter',months:3,amount:1797,cashReference:' RC-42 '},plans);
  assert.deepEqual({...result,notes:undefined},{planName:'Starter',months:3,amount:1797,expectedAmount:1797,cashReference:'RC-42',notes:undefined});
});

test('cash plan activation rejects inactive plans and unsupported durations',()=>{
  assert.throws(()=>normalizeCashPlanActivation({confirmCashReceived:true,planName:'Old',months:1,amount:100},plans),/active plan/);
  assert.throws(()=>normalizeCashPlanActivation({confirmCashReceived:true,planName:'Starter',months:2,amount:1198},plans),/1, 3, 6, 9, or 12/);
});

test('canteen detail posts confirmed cash activation and calculates amount',async()=>{
  const {JSDOM}=require('jsdom');const fs=require('fs');const path=require('path');
  const dom=new JSDOM('<main id="page"></main>',{runScripts:'outside-only'}),w=dom.window;
  w.eval(fs.readFileSync(path.join(__dirname,'../marketing-web/canteen-detail.js'),'utf8'));
  const canteen={id:7,canteenName:'Swad Kitchen',selectedPlan:'Starter',status:'Trial',planType:'Trial'};
  w.document.querySelector('#page').innerHTML=w.CanteenDetail.render({canteen,plans,payments:[],canManage:true});
  const calls=[];w.CanteenDetail.bind({canteen,plans,api:async(route,options)=>calls.push([route,JSON.parse(options.body)]),onBack:()=>{},onUpdated:async()=>{},onDineIn:()=>{},onBlock:()=>{}});
  w.document.querySelector('#cashPlanMonths').value='3';w.document.querySelector('#cashPlanMonths').dispatchEvent(new w.Event('change'));
  w.document.querySelector('#cashConfirmed').checked=true;w.document.querySelector('#cashPlanForm').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
  for(let i=0;i<20&&!calls.length;i++)await new Promise(resolve=>setTimeout(resolve,5));
  assert.equal(calls[0][0],'/marketing-api/canteens/7/activate-cash-plan');assert.equal(calls[0][1].amount,1797);assert.equal(calls[0][1].confirmCashReceived,true);dom.window.close();
});
