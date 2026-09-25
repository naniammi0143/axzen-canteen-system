const test = require('node:test');
const assert = require('node:assert/strict');
const { HELP_PROBLEMS, normalizeHelpSubmission, normalizeHelpStatus } = require('../backend/help-center');

test('help center exposes exactly ten POS problem choices', () => {
  assert.equal(HELP_PROBLEMS.length, 10);
  assert.equal(new Set(HELP_PROBLEMS).size, 10);
});

test('help request validation keeps customer and canteen tracking details', () => {
  const ticket = normalizeHelpSubmission({
    customerName: '  Ravi Kumar  ',
    phone: '+91 98765 43210',
    problemType: 'Printer is not printing',
    message: 'Receipt is not coming after payment.'
  }, { canteenId: 'AXC-1002', canteenName: 'Ravi Foods', submittedByLogin: 'owner01' });
  assert.equal(ticket.canteenId, 'AXC-1002');
  assert.equal(ticket.customerName, 'Ravi Kumar');
  assert.equal(ticket.status, 'Pending');
  assert.equal(ticket.submittedByLogin, 'owner01');
});

test('help request rejects invalid fields and only permits Pending or Solved', () => {
  assert.throws(() => normalizeHelpSubmission({customerName:'R',phone:'123',problemType:'Unknown',message:'x'}), /name/);
  assert.equal(normalizeHelpStatus('Solved'), 'Solved');
  assert.throws(() => normalizeHelpStatus('Deleted'), /Pending or Solved/);
});

test('POS help form submits customer details and renders ticket tracking', async () => {
  const {JSDOM}=require('jsdom');const fs=require('fs');const path=require('path');
  const dom=new JSDOM('<main id="root"></main>',{runScripts:'outside-only'});const w=dom.window;
  w.eval(fs.readFileSync(path.join(__dirname,'../sa/help-center.js'),'utf8'));
  const writes=[];
  const api=async(route,options={})=>{
    if(route==='/help/problems')return {problems:HELP_PROBLEMS,supportPhone:'8790568446'};
    if(route==='/help/tickets'&&options.method==='POST'){writes.push(JSON.parse(options.body));return {success:true};}
    if(route==='/help/tickets')return {tickets:[{id:11,problemType:HELP_PROBLEMS[0],message:'Printer stopped',status:'Pending',createdAt:new Date().toISOString()}]};
    throw Error(route);
  };
  await w.HelpCenter.mount(w.document.querySelector('#root'),{api,user:{name:'Ravi'},settings:{canteenName:'Ravi Foods'}});
  assert.equal(w.document.querySelectorAll('#helpProblem option').length,11);
  assert.match(w.document.querySelector('#helpTickets').textContent,/Printer stopped/);
  w.document.querySelector('#helpCustomerPhone').value='9876543210';
  w.document.querySelector('#helpProblem').value=HELP_PROBLEMS[1];
  w.document.querySelector('#helpMessage').value='Bluetooth printer is disconnected.';
  w.document.querySelector('#helpRequestForm').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
  for(let i=0;i<20&&!writes.length;i++)await new Promise(resolve=>setTimeout(resolve,5));
  assert.equal(writes[0].customerName,'Ravi');assert.equal(writes[0].phone,'9876543210');dom.window.close();
});

test('marketing Help Center sends Solved status through the admin endpoint', async () => {
  const {JSDOM}=require('jsdom');const fs=require('fs');const path=require('path');
  const dom=new JSDOM('<main id="page"></main>',{runScripts:'outside-only'});const w=dom.window;
  w.eval(fs.readFileSync(path.join(__dirname,'../marketing-web/help-center.js'),'utf8'));
  w.document.querySelector('#page').innerHTML=w.MarketingHelpCenter.render([{_id:'abc123',canteenId:'AXC-1',canteenName:'Ravi Foods',customerName:'Ravi',phone:'9876543210',problemType:HELP_PROBLEMS[0],message:'No print',status:'Pending'}]);
  const calls=[];w.MarketingHelpCenter.bind({api:async(route,options)=>calls.push([route,JSON.parse(options.body)]),refresh:async()=>{},notify:()=>{}});
  w.document.querySelector('[data-next="Solved"]').click();
  await new Promise(resolve=>setTimeout(resolve,5));
  assert.deepEqual(calls[0],['/marketing-api/help-tickets/abc123/status',{status:'Solved'}]);dom.window.close();
});
