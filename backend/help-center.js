const HELP_PROBLEMS = Object.freeze([
  'Printer is not printing',
  'Printer connection problem',
  'Login or password problem',
  'Billing or order problem',
  'Menu, item or price problem',
  'Reports problem',
  'Dine In or table problem',
  'Payment or subscription problem',
  'App sync or offline problem',
  'Other problem'
]);

const clean = (value, max) => String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);

function normalizeHelpSubmission(body = {}, context = {}) {
  const customerName = clean(body.customerName, 80);
  const phone = clean(body.phone, 20).replace(/[^0-9+ -]/g, '');
  const problemType = clean(body.problemType, 100);
  const message = clean(body.message, 1000);
  if (customerName.length < 2) throw new Error('Enter your name.');
  if (!/^[+]?[0-9][0-9 -]{7,18}$/.test(phone)) throw new Error('Enter a valid phone number.');
  if (!HELP_PROBLEMS.includes(problemType)) throw new Error('Select a help problem.');
  if (message.length < 5) throw new Error('Describe the help you need.');
  return {
    canteenId: clean(context.canteenId, 60),
    canteenName: clean(context.canteenName, 120) || 'Canteen',
    customerName,
    phone,
    problemType,
    title: problemType,
    message,
    status: 'Pending',
    priority: 'Normal',
    submittedByLogin: clean(context.submittedByLogin, 80)
  };
}

function normalizeHelpStatus(value) {
  const status = clean(value, 20);
  if (!['Pending', 'Solved'].includes(status)) throw new Error('Status must be Pending or Solved.');
  return status;
}

module.exports = { HELP_PROBLEMS, normalizeHelpSubmission, normalizeHelpStatus };
