import { money } from '../../../../../shared/finance';
import { printOrShareHtml } from '../../report';
import { Row } from '../../types';
import { getBusinessProfile } from '../../storage/profileStorage';
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
  orgPhone?: string;
}

const formatPhone = (phone?: string) => {
  if (!phone) return '';
  const clean = phone.replace(/^\+91\s*/, '').trim();
  return clean ? `+91 ${clean}` : '';
};

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
  const orgPhone = options?.orgPhone || '';

  // Dynamic Business Profile: Automatically reflects latest firm name, phone, address, and GSTIN
  const profile = await getBusinessProfile();
  const firmDisplayName = profile?.firmName?.trim() || orgName || 'ThekaBook';
  const firmPhone = profile?.phone?.trim() || orgPhone || '';
  const firmAddressParts = [
    profile?.address?.trim(),
    profile?.city?.trim(),
    profile?.state?.trim(),
  ].filter(Boolean);
  const firmAddress = firmAddressParts.join(', ');
  const firmGstin = profile?.gstin?.trim() || '';
  const firmLogo = profile?.logo?.trim() || '';

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
  const dueRupees = displayNet > 0 ? (displayNet / 100).toFixed(2) : '';
  const upiPayUrl = upiId
    ? `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(firmDisplayName || 'ThekaBook')}${dueRupees ? `&am=${encodeURIComponent(dueRupees)}` : ''}&cu=INR`
    : '';

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
  <title>${esc(party.name)} - Statement (${esc(periodLabel)})</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #0F172A;
      background: #FFFFFF;
      padding: 30px 34px;
      font-size: 12px;
      line-height: 1.5;
    }

    /* 1. Unified Statement Header Card (Clean, Modern & Cohesive) */
    .header-card {
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-top: 3px solid #2563EB;
      border-radius: 10px;
      padding: 16px 20px;
      margin-bottom: 20px;
    }
    .header-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .brand-title {
      font-size: 20px;
      font-weight: 800;
      color: #0F172A;
      letter-spacing: -0.2px;
    }
    .brand-phone {
      font-size: 11.5px;
      font-weight: 600;
      color: #334155;
      margin-top: 2px;
    }
    .brand-address {
      font-size: 11px;
      font-weight: 500;
      color: #64748B;
      margin-top: 2px;
      max-width: 420px;
      line-height: 1.35;
    }
    .brand-tax {
      font-size: 10.5px;
      color: #475569;
      margin-top: 3px;
    }
    .brand-tax b {
      color: #0F172A;
      font-family: monospace;
      font-size: 11px;
    }
    .doc-badge {
      font-size: 11px;
      font-weight: 700;
      color: #1D4ED8;
      background: #EFF6FF;
      border: 1px solid #BFDBFE;
      padding: 4px 10px;
      border-radius: 6px;
      letter-spacing: 0.5px;
    }
    .header-divider {
      height: 1px;
      background: #E2E8F0;
      margin: 12px 0 14px 0;
    }
    .header-grid {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
    }
    .party-col {
      text-align: left;
    }
    .meta-col {
      text-align: right;
    }
    .col-title {
      font-size: 9.5px;
      font-weight: 700;
      color: #64748B;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      margin-bottom: 4px;
    }
    .party-name {
      font-size: 17px;
      font-weight: 800;
      color: #0F172A;
      line-height: 1.2;
    }
    .party-phone {
      font-size: 12px;
      font-weight: 500;
      color: #475569;
      margin-top: 4px;
    }
    .meta-item {
      font-size: 11.5px;
      color: #475569;
      margin-top: 3px;
    }
    .meta-label {
      color: #64748B;
      font-weight: 500;
    }
    .meta-val {
      color: #0F172A;
      font-weight: 600;
    }
    .meta-period {
      font-weight: 700;
      color: #1D4ED8;
    }

    /* 2. Three-Card Financial Summary */
    .summary-grid {
      display: flex;
      gap: 12px;
      margin-bottom: 22px;
    }
    .sum-card {
      flex: 1;
      background: #FFFFFF;
      border: 1px solid #E2E8F0;
      border-radius: 10px;
      padding: 12px 14px;
    }
    .sum-card-debit {
      border-top: 3px solid #DC2626;
    }
    .sum-card-credit {
      border-top: 3px solid #059669;
    }
    .sum-card-net {
      border-top: 3px solid ${netColor};
      background: ${netBg};
    }
    .sum-label {
      font-size: 10px;
      font-weight: 700;
      color: #64748B;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      margin-bottom: 4px;
    }
    .sum-val {
      font-size: 18px;
      font-weight: 800;
      letter-spacing: -0.2px;
    }

    /* 3. Unique Modern Table */
    table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      border: 1px solid #E2E8F0;
      border-radius: 10px;
      overflow: hidden;
      margin-bottom: 20px;
    }
    thead th {
      background: #0F172A;
      color: #FFFFFF;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 10px 12px;
      text-align: left;
    }
    tbody td {
      padding: 10px 12px;
      border-bottom: 1px solid #F1F5F9;
      font-size: 11.5px;
      vertical-align: middle;
    }
    tbody tr:nth-child(even) {
      background: #F8FAFC;
    }
    tbody tr:last-child td {
      border-bottom: none;
    }
    tfoot td {
      background: #F8FAFC;
      font-weight: 800;
      font-size: 12px;
      padding: 11px 12px;
      border-top: 2px solid #CBD5E1;
    }
    .num { width: 36px; color: #94A3B8; text-align: center; }
    .nowrap { white-space: nowrap; font-weight: 600; color: #1E293B; }
    .center { text-align: center; }
    .right { text-align: right; }
    .gave { color: #DC2626; font-weight: 700; white-space: nowrap; }
    .got { color: #059669; font-weight: 700; white-space: nowrap; }
    .bal { color: #0F172A; font-weight: 700; white-space: nowrap; }
    .mode-pill {
      display: inline-block;
      font-size: 9.5px;
      font-weight: 700;
      padding: 2px 7px;
      border-radius: 4px;
      background: #F1F5F9;
      color: #475569;
      border: 1px solid #E2E8F0;
    }

    /* 4. UPI Pay & Sign-off Section */
    .upi-box {
      background: #EFF6FF;
      border: 1px solid #BFDBFE;
      border-radius: 8px;
      padding: 8px 14px;
      display: inline-flex;
      align-items: center;
      margin-bottom: 22px;
      cursor: pointer;
      transition: background 0.15s ease;
    }
    .upi-box:hover {
      background: #DBEAFE;
    }
    .upi-left {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .upi-badge {
      font-size: 10px;
      font-weight: 800;
      color: #FFFFFF;
      background: #1D4ED8;
      padding: 2px 6px;
      border-radius: 4px;
      letter-spacing: 0.5px;
    }
    .upi-label {
      font-size: 11.5px;
      font-weight: 600;
      color: #1E3A8A;
    }
    .upi-id-link {
      font-size: 12.5px;
      font-weight: 800;
      color: #1D4ED8;
      text-decoration: underline;
      cursor: pointer;
    }
    .upi-id-text {
      user-select: all;
      -webkit-user-select: all;
      -moz-user-select: all;
    }
    .upi-copied-tag {
      display: none;
      font-size: 10px;
      font-weight: 700;
      color: #FFFFFF;
      background: #059669;
      padding: 2px 7px;
      border-radius: 4px;
      margin-left: 4px;
    }
    .sig-section {
      display: flex;
      justify-content: space-between;
      margin-top: 36px;
      padding-top: 10px;
    }
    .sig-box {
      width: 220px;
      text-align: center;
    }
    .sig-line {
      border-bottom: 1.5px dashed #CBD5E1;
      height: 40px;
      margin-bottom: 8px;
    }
    .sig-title {
      font-size: 11px;
      font-weight: 700;
      color: #475569;
    }

    @media print {
      body { padding: 16px 20px; }
      .header-card { margin-bottom: 14px; }
      .summary-grid { margin-bottom: 16px; }
    }
  </style>
</head>
<body>
  <!-- 1. Unified Statement Header Card (Clean, Modern & Balanced) -->
  <div class="header-card">
    <div class="header-top">
      <div style="display: flex; align-items: center; gap: 14px;">
        ${firmLogo ? `<img src="${firmLogo}" style="width: 48px; height: 48px; border-radius: 8px; object-fit: contain; border: 1px solid #E2E8F0; background: #FFFFFF;" />` : ''}
        <div>
          <div class="brand-title">${esc(firmDisplayName)}</div>
        ${firmPhone ? `<div class="brand-phone">Phone: ${esc(formatPhone(firmPhone))}</div>` : ''}
        ${firmAddress ? `<div class="brand-address">${esc(firmAddress)}</div>` : ''}
        ${firmGstin ? `<div class="brand-tax">GSTIN: <b>${esc(firmGstin)}</b></div>` : ''}
        </div>
      </div>
      <div class="doc-badge">KHATA STATEMENT</div>
    </div>
    <div class="header-divider"></div>
    <div class="header-grid">
      <div class="party-col">
        <div class="col-title">STATEMENT ISSUED TO</div>
        <div class="party-name">${esc(party.name)}</div>
        ${party.phone ? `<div class="party-phone">Phone: ${esc(formatPhone(party.phone))}</div>` : ''}
      </div>
      <div class="meta-col">
        <div class="col-title">STATEMENT DETAILS</div>
        <div class="meta-item"><span class="meta-label">Date:</span> <span class="meta-val">${esc(generatedOn)}</span></div>
        <div class="meta-item"><span class="meta-label">Period:</span> <span class="meta-val meta-period">${esc(periodLabel)}</span></div>
      </div>
    </div>
  </div>

  <!-- 2. Financial Summary Cards -->
  <div class="summary-grid">
    <div class="sum-card sum-card-debit">
      <div class="sum-label">${isFiltered ? 'Period Given' : 'Total Given'}</div>
      <div class="sum-val" style="color:#DC2626;">${esc(money(periodGave))}</div>
    </div>
    <div class="sum-card sum-card-credit">
      <div class="sum-label">${isFiltered ? 'Period Received' : 'Total Received'}</div>
      <div class="sum-val" style="color:#059669;">${esc(money(periodGot))}</div>
    </div>
    <div class="sum-card sum-card-net">
      <div class="sum-label" style="color:${netColor};">${esc(netLabel)}</div>
      <div class="sum-val" style="color:${netColor};">${esc(money(Math.abs(displayNet)))}</div>
    </div>
  </div>

  <!-- 3. Modern Ledger Table -->
  <table>
    <thead>
      <tr>
        <th class="center">#</th>
        <th>Date</th>
        <th>Particulars / Note</th>
        <th class="center">Mode</th>
        <th class="right" style="color:#FCA5A5;">You Gave</th>
        <th class="right" style="color:#86EFAC;">You Got</th>
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

  ${upiId ? `
  <div class="upi-box" onclick="copyUpiText(event, '${esc(upiId)}')" title="Click to copy UPI ID">
    <div class="upi-left">
      <span class="upi-badge">UPI</span>
      <span class="upi-label">Pay via UPI:</span>
      <a href="${esc(upiPayUrl)}"
         class="upi-id-link"
         title="Click to copy UPI ID"
         onclick="copyUpiText(event, '${esc(upiId)}')">
        <span class="upi-id-text">${esc(upiId)}</span>
      </a>
      <span id="upi-copied-tag" class="upi-copied-tag">✓ Copied!</span>
    </div>
  </div>
  ` : ''}

  <!-- 4. Business Sign-off Blocks -->
  <div class="sig-section">
    <div class="sig-box">
      <div class="sig-line"></div>
      <div class="sig-title">Party / Receiver Signature</div>
    </div>
    <div class="sig-box">
      <div class="sig-line"></div>
      <div class="sig-title">Authorized Signatory (${esc(firmDisplayName)})</div>
    </div>
  </div>

  <script>
    function copyUpiText(e, id) {
      if (!id) return;
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(id);
        } else {
          var t = document.createElement('textarea');
          t.value = id;
          t.style.position = 'fixed';
          t.style.opacity = '0';
          document.body.appendChild(t);
          t.focus();
          t.select();
          document.execCommand('copy');
          document.body.removeChild(t);
        }
        var tag = document.getElementById('upi-copied-tag');
        if (tag) {
          tag.style.display = 'inline-block';
          if (window._upiTimer) clearTimeout(window._upiTimer);
          window._upiTimer = setTimeout(function() {
            tag.style.display = 'none';
          }, 2000);
        }
      } catch (err) {}
    }
  </script>
</body>
</html>`;

  const safeTitle = `${String(party.name || 'Khata').replace(/\s+/g, '_')}_${periodLabel.replace(/\s+/g, '_')}`;
  await printOrShareHtml(html, safeTitle);
}
