const test=require('node:test'),assert=require('node:assert/strict');
const taxes=require('../sa/bill-taxes');
const gst={rows:[{id:'cgst',enabled:true,rate:2.5},{id:'sgst',enabled:true,rate:2.5}]};
test('discount precedes configured tax and total is rounded to paise',()=>{
 const bill=taxes.calculate(540,40,gst);
 assert.equal(bill.total,525);assert.equal(bill.taxTotal,25);assert.deepEqual(bill.taxes.map(t=>t.amount),[12.5,12.5]);
 assert.equal(taxes.calculate(100,0).total,100);
 assert.equal(taxes.calculate(19.99,0,gst).total,20.99);
});
test('service charge is separate and included in the tax base',()=>{
 const bill=taxes.calculate(200,20,{rows:[...gst.rows,{id:'service',rate:10,enabled:true}]});
 assert.equal(bill.charges[0].amount,18);assert.equal(bill.taxableAmount,198);assert.equal(bill.total,207.9);
});
test('reject conflicting tax systems, malformed percentages and discount exceeding subtotal',()=>{
 for(const config of [{rows:[...gst.rows,{id:'gst',enabled:true,rate:5}]},{rows:[{id:'cgst',enabled:true,rate:2.5}]},{rows:[{id:'vat',enabled:true,rate:-1}]},{rows:[{id:'gst',enabled:true,rate:'NaN'}]},{rows:[{id:'gst',enabled:true,rate:101}]}])assert.throws(()=>taxes.normalize(config));
 assert.throws(()=>taxes.calculate(10,11,gst));assert.throws(()=>taxes.calculate(10,NaN,gst));
 const original=taxes.calculate(100,0,gst);gst.rows[0].rate=9;assert.equal(original.taxes[0].rate,2.5);gst.rows[0].rate=2.5;
});
