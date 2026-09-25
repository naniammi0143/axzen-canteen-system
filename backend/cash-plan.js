const clean = (value, max = 120) => String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);
const numericPrice = value => Number(String(value || '').replace(/[^0-9.]/g, '') || 0);

function normalizeCashPlanActivation(body = {}, plans = []) {
  if (body.confirmCashReceived !== true) throw new Error('Confirm that cash was received.');
  const planName = clean(body.planName);
  const plan = plans.find(item => item.active !== false && clean(item.name).toLowerCase() === planName.toLowerCase());
  if (!plan) throw new Error('Select an active plan.');
  const months = Number(body.months);
  if (![1, 3, 6, 9, 12].includes(months)) throw new Error('Select 1, 3, 6, 9, or 12 months.');
  const monthlyPrice = numericPrice(plan.offerPrice);
  const expectedAmount = monthlyPrice * months;
  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Enter the cash amount received.');
  if (expectedAmount > 0 && amount !== expectedAmount) throw new Error(`Plan amount must be exactly Rs ${expectedAmount}.`);
  return {
    planName: clean(plan.name), months, amount, expectedAmount,
    cashReference: clean(body.cashReference, 80),
    notes: clean(body.notes, 300)
  };
}

module.exports = { normalizeCashPlanActivation, numericPrice };
