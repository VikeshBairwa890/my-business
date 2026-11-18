import { money } from '../../../../../shared/finance';
import { printOrShareHtml } from '../../report';
import { Row } from '../../types';
import {
  PartySummary,
  buildPartyTimeline,
  formatShortDate,
  getCategoryMeta,
  getEntryDateStr,
  getPrimaryUpiId,
  isDebitEntry,
} from './khataUtils';

const esc = (v: unknown) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]!));

export interface KhataPdfOptions {
  fromDate?: string;
  toDate?: string;
  periodLabel?: string;
}

export async function generateKhataLedgerPdf(
  summary: PartySummary,
  allEntries: Row[],
  orgName: string,
  options?: KhataPdfOptions
): Promise<void> {
  const { party } = summary;
  const fromDate = options?.fromDate || '';
  const toDate = options?.toDate || '';
  const periodLabel = options?.periodLabel || 'All Time';

  // Full chronological timeline so running balance stays mathematically accurate
  const fullChronological = [...buildPartyTimeline(party.id, allEntries)].reverse();

  // Filter by selected date range (if any)
  const scopedRows = fullChronological.filter(({ entry }) => {
    const d = getEntryDateStr(entry);
    if (fromDate && d < fromDate) return false;
    if (toDate && d > toDate) return false;
    return true;
  });

  // Compute totals for the selected period
  let periodGave = 0;
  let periodGot = 0;
  for (const { entry } of scopedRows) {
    const amt = Number(entry.amount || 0);
    if (isDebitEntry(entry)) periodGave += amt;
    else periodGot += amt;
  }
  const periodNet = periodGave - periodGot;

  const isFiltered = Boolean(fromDate || toDate);
  const displayNet = isFiltered ? periodNet : summary.balance;
  const upiId = displayNet > 0 ? await getPrimaryUpiId() : '';

  const catMeta = getCategoryMeta(party.category);
  const catLabel = catMeta.value === 'LABOUR' ? 'Worker' : catMeta.label;
  const generatedOn = new Date().toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const netLabel =
    displayNet > 0 ? 'You Will Get' : displayNet < 0 ? 'You Will Give' : 'Settled';
  const netColor =
    displayNet > 0 ? '#DC2626' : displayNet < 0 ? '#059669' : '#475569';
  const netBg =
    displayNet > 0 ? '#FEF2F2' : displayNet < 0 ? '#ECFDF5' : '#F8FAFC';

  const rowsHtml = scopedRows
    .map(({ entry, runningBalance }, i) => {
      const isGave = isDebitEntry(entry);
      const modeLabel =
        entry.mode === 'BANK_TRANSFER' ? 'Bank' : entry.mode || 'Cash';
      const balText =
        runningBalance > 0
          ? `${money(runningBalance)} Dr`
          : runningBalance < 0
            ? `${money(Math.abs(runningBalance))} Cr`
            : '₹0';
      return `
        <tr>
          <td class="num">${i + 1}</td>
          <td class="nowrap">${esc(formatShortDate(entry.date))}</td>
          <td>${esc(entry.note || '—')}</td>
          <td class="center"><span class="mode">${esc(modeLabel)}</span></td>
          <td class="right gave">${isGave ? esc(money(entry.amount)) : '—'}</td>
          <td class="right got">${!isGave ? esc(money(entry.amount)) : '—'}</td>
          <td class="right bal">${esc(balText)}</td>
        </tr>
      `;
    })
    .join('');

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${esc(party.name)} - Khata Statement (${esc(periodLabel)})</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      color: #0F172A;
      margin: 0;
      padding: 28px;
      background: #FFFFFF;
      font-size: 12px;
      line-height: 1.45;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #2563EB;
      padding-bottom: 14px;
      margin-bottom: 18px;
    }
    .brand {
      font-size: 20px;
      font-weight: 800;
      color: #0F172A;
      letter-spacing: -0.3px;
    }
    .brand-sub {
      font-size: 11px;
      color: #64748B;
      margin-top: 2px;
    }
    .doc-meta {
      text-align: right;
    }
    .doc-title {
      font-size: 13px;
      font-weight: 800;
      color: #2563EB;
      letter-spacing: 0.6px;
    }
    .doc-date {
      font-size: 11px;
      color: #64748B;
      margin-top: 3px;
    }
    .period-pill {
      display: inline-block;
      margin-top: 5px;
      background: #EFF6FF;
      color: #1D4ED8;
      border: 1px solid #BFDBFE;
      font-size: 10px;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 12px;
    }
    .party-box {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 10px;
      padding: 12px 16px;
      margin-bottom: 16px;
    }
    .party-name {
      font-size: 16px;
      font-weight: 800;
      color: #0F172A;
    }
    .party-sub {
      font-size: 11px;
      color: #64748B;
      margin-top: 2px;
    }
    .summary-grid {
      display: flex;
      gap: 12px;
      margin-bottom: 18px;
    }
    .sum-card {
      flex: 1;
      border: 1px solid #E2E8F0;
      border-radius: 10px;
      padding: 12px 14px;
      background: #FFFFFF;
    }
    .sum-label {
      font-size: 11px;
      font-weight: 600;
      color: #64748B;
      margin-bottom: 4px;
    }
    .sum-val {
      font-size: 18px;
      font-weight: 800;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #E2E8F0;
      border-radius: 8px;
      overflow: hidden;
    }
    thead th {
      background: #F1F5F9;
      color: #475569;
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      padding: 10px 10px;
      text-align: left;
      border-bottom: 1px solid #E2E8F0;
    }
    tbody td {
      padding: 9px 10px;
      border-bottom: 1px solid #F1F5F9;
      vertical-align: middle;
    }
    tbody tr:last-child td {
      border-bottom: none;
    }
    tfoot td {
      background: #F8FAFC;
      font-weight: 800;
      padding: 10px 10px;
      border-top: 1.5px solid #CBD5E1;
    }
    .num { width: 32px; color: #94A3B8; text-align: center; }
    .nowrap { white-space: nowrap; font-weight: 600; }
    .center { text-align: center; }
    .right { text-align: right; }
    .gave { color: #DC2626; font-weight: 700; white-space: nowrap; }
    .got { color: #059669; font-weight: 700; white-space: nowrap; }
    .bal { color: #334155; font-weight: 700; white-space: nowrap; }
    .mode {
      display: inline-block;
      background: #F1F5F9;
      color: #475569;
      font-size: 10px;
      font-weight: 700;
      padding: 2px 7px;
      border-radius: 5px;
    }
    .upi-box {
      margin-top: 16px;
      padding: 10px 14px;
      background: #EFF6FF;
      border: 1px solid #BFDBFE;
      border-radius: 8px;
      font-size: 12px;
      color: #1E3A8A;
    }
    .footer {
      margin-top: 22px;
      padding-top: 10px;
      border-top: 1px solid #E2E8F0;
      display: flex;
      justify-content: space-between;
      font-size: 10px;
      color: #94A3B8;
    }
    @media print {
      body { padding: 14px; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand">${esc(orgName || 'ThekaBook')}</div>
      <div class="brand-sub">Khata Book Account Statement</div>
    </div>
    <div class="doc-meta">
      <div class="doc-title">LEDGER STATEMENT</div>
      <div class="doc-date">Generated: ${esc(generatedOn)}</div>
      <div class="period-pill">Period: ${esc(periodLabel)}</div>
    </div>
  </div>

  <div class="party-box">
    <div>
      <div class="party-name">${esc(party.name)}</div>
      <div class="party-sub">${esc(catLabel)}${party.phone ? ` • +91 ${esc(party.phone)}` : ''}${party.notes ? ` • ${esc(party.notes)}` : ''}</div>
    </div>
    <div style="text-align:right;font-size:11px;color:#64748B;">
      Entries: <strong style="color:#0F172A;">${scopedRows.length}</strong>
    </div>
  </div>

  <div class="summary-grid">
    <div class="sum-card">
      <div class="sum-label">${isFiltered ? 'Period Given' : 'Total Given'}</div>
      <div class="sum-val" style="color:#DC2626;">${esc(money(periodGave))}</div>
    </div>
    <div class="sum-card">
      <div class="sum-label">${isFiltered ? 'Period Received' : 'Total Received'}</div>
      <div class="sum-val" style="color:#059669;">${esc(money(periodGot))}</div>
    </div>
    <div class="sum-card" style="background:${netBg};border-color:${netColor}44;">
      <div class="sum-label" style="color:${netColor};font-weight:700;">${esc(netLabel)}</div>
      <div class="sum-val" style="color:${netColor};">${esc(money(Math.abs(displayNet)))}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th class="center">#</th>
        <th>Date</th>
        <th>Details / Note</th>
        <th class="center">Mode</th>
        <th class="right" style="color:#DC2626;">You Gave</th>
        <th class="right" style="color:#059669;">You Got</th>
        <th class="right">Balance</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="4" class="right">${isFiltered ? 'Period Total' : 'Total'}</td>
        <td class="right gave">${esc(money(periodGave))}</td>
        <td class="right got">${esc(money(periodGot))}</td>
        <td class="right" style="color:${netColor};">${esc(money(Math.abs(displayNet)))} (${esc(netLabel)})</td>
      </tr>
    </tfoot>
  </table>

  ${upiId ? `<div class="upi-box"><strong>Pay via UPI:</strong> ${esc(upiId)}</div>` : ''}

  <div class="footer">
    <span>Statement for ${esc(party.name)} (${esc(periodLabel)})</span>
    <span>Generated via ThekaBook</span>
  </div>
</body>
</html>`;

  const safeTitle = `${String(party.name || 'Khata').replace(/\s+/g, '_')}_${periodLabel.replace(/\s+/g, '_')}`;
  await printOrShareHtml(html, safeTitle);
}
