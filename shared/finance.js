// Money is integer paise. No floating-point rupee ledger arithmetic.
export const money = n => `₹${(Number(n || 0) / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
export function paise(value) {
  const s = String(value).trim();
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(s)) throw new Error('Enter an amount up to 999999999.99 with up to 2 decimal places.');
  const [whole, fraction = ''] = s.split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}
export function wages(units, minutes, dailyRate, overtimeRate) {
  return Math.round(Number(units) * Number(dailyRate)) + Math.round(Number(minutes) * Number(overtimeRate) / 60);
}
export function siteSummary(site, attendance, entries) {
  const rows = entries.filter(e => e.site_id === site.id && !e.voided_at);
  const sum = kind => rows.filter(e => e.kind === kind).reduce((a,e) => a + Number(e.amount), 0);
  const labour = attendance.filter(a => a.site_id === site.id).reduce((s,a) => s + Number(a.amount), 0);
  const contract = Number(site.contract_amount) + sum('EXTRA');
  const material = sum('MATERIAL'), expenses = sum('EXPENSE');
  const cost = labour + material + expenses;
  const received = sum('RECEIPT'), wagesPaid = sum('WAGE_PAYMENT'), suppliersPaid = sum('SUPPLIER_PAYMENT');
  const remaining = site.status === 'COMPLETED' ? 0 : Number(site.remaining_estimate);
  return { contract, labour, material, expenses, cost, received, wagesPaid, suppliersPaid,
    ownerBalance: contract - received, labourBalance: labour - wagesPaid,
    supplierBalance: material + expenses - suppliersPaid,
    cash: received - wagesPaid - suppliersPaid,
    profit: contract - cost - remaining, remaining,
    final: site.status === 'COMPLETED' };
}
export function workerSummary(worker, attendance, entries) {
  const earned = attendance.filter(a => a.worker_id === worker.id).reduce((s,a) => s + Number(a.amount), 0);
  const paid = entries.filter(e => e.worker_id === worker.id && e.kind === 'WAGE_PAYMENT' && !e.voided_at).reduce((s,e) => s + Number(e.amount), 0);
  return { earned, paid, balance: earned - paid };
}
export function reportText(data, siteId) {
  const sites = siteId ? data.sites.filter(s => s.id === siteId) : data.sites;
  const scopedAttendance = siteId ? data.attendance.filter(a => a.site_id === siteId) : data.attendance;
  const scopedEntries = siteId ? data.entries.filter(e => e.site_id === siteId) : data.entries;
  const workers = siteId ? data.workers.filter(w => scopedAttendance.some(a => a.worker_id === w.id) || scopedEntries.some(e => e.worker_id === w.id)) : data.workers;
  return ['THEKABOOK • Contractor statement', data.organization?.name || '',
    `Generated: ${new Date().toLocaleString('en-IN')}`, '',
    ...sites.flatMap(s => {
      const f = siteSummary(s, data.attendance, data.entries);
      return [s.name, `Owner: ${s.owner_name}`, `Contract incl. extras: ${money(f.contract)}`,
        `Received: ${money(f.received)} | Owner balance: ${money(f.ownerBalance)}`,
        `Labour earned: ${money(f.labour)} | Paid: ${money(f.wagesPaid)}`,
        `Material: ${money(f.material)} | Other costs: ${money(f.expenses)}`,
        `Supplier outstanding: ${money(f.supplierBalance)}`,
        `Cash movement: ${money(f.cash)}`, `Remaining cost estimate: ${money(f.remaining)}`,
        `${f.final ? 'Final' : 'Estimated'} site margin: ${money(f.profit)} (before shared overhead/tax)`, '',
        'TRANSACTIONS', ...data.entries.filter(e => e.site_id === s.id).map(e =>
          `${String(e.date).slice(0,10)} | ${e.kind} | ${e.description} | ${money(e.amount)}${e.voided_at ? ' [VOID]' : ''}`),
        '', 'ATTENDANCE', ...data.attendance.filter(a => a.site_id === s.id).map(a =>
          `${String(a.date).slice(0,10)} | ${data.workers.find(w => w.id === a.worker_id)?.name || ''} | ${a.units} day | OT ${a.overtime_minutes} min | ${money(a.amount)}`), ''];
    }), siteId ? 'LABOUR BALANCES — ALLOCATED TO THIS SITE' : 'LABOUR BALANCES — ALL SITES', ...workers.map(w => {
      const f = workerSummary(w, scopedAttendance, scopedEntries);
      return `${w.name}: earned ${money(f.earned)}, paid ${money(f.paid)}, balance ${money(f.balance)}`;
    }), '', 'Internal record, not a tax invoice or proof of client acceptance.'].join('\n');
}
