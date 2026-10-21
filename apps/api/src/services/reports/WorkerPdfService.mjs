import PDFDocument from 'pdfkit';
import prisma from '../../prisma.mjs';

export class WorkerPdfService {
  static async generateWorkerReportPdf(workerId, query = {}) {
    const worker = await prisma.worker.findUnique({
      where: { id: workerId },
    });
    if (!worker) return null;

    const org = await prisma.organization.findUnique({
      where: { id: worker.orgId },
    });
    const sites = await prisma.site.findMany({
      where: { orgId: worker.orgId },
    });

    const now = new Date();
    const year = parseInt(query.y, 10) || now.getFullYear();
    const month = parseInt(query.m, 10) || (now.getMonth() + 1);

    const countDays = new Date(year, month, 0).getDate();
    const monthPrefix = `${year}-${String(month).padStart(2, '0')}`;
    const startDate = new Date(`${monthPrefix}-01`);
    const endDate = new Date(`${monthPrefix}-${String(countDays).padStart(2, '0')}`);
    const monthName = new Date(year, month - 1, 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' });

    const attendance = await prisma.attendance.findMany({
      where: {
        orgId: worker.orgId,
        workerId: worker.id,
        date: { gte: startDate, lte: endDate },
      },
      orderBy: { date: 'asc' },
    });

    const entries = await prisma.entry.findMany({
      where: {
        orgId: worker.orgId,
        workerId: worker.id,
        date: { gte: startDate, lte: endDate },
        voidedAt: null,
      },
      orderBy: { date: 'asc' },
    });

    // Calculations
    const siteMap = new Map(sites.map(s => [s.id, s.name]));
    let presentDays = 0;
    let halfDays = 0;
    let totalOtMinutes = 0;
    let totalEarned = 0;

    for (const a of attendance) {
      const u = Number(a.units);
      if (u >= 1) presentDays++;
      else if (u > 0) halfDays++;
      totalOtMinutes += a.overtimeMinutes || 0;
      totalEarned += Number(a.amount || 0);
    }

    const totalPaid = entries.reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const balance = totalEarned - totalPaid;
    const dailyRate = Number(worker.dailyRate);
    const overtimeRate = Number(worker.overtimeRate);

    // Build PDF Document
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const buffers = [];

      doc.on('data', chunk => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      // Header Banner
      doc.rect(40, 40, 515, 65).fill('#0f172a');
      doc.fillColor('#ffffff').fontSize(16).text(org?.name || 'ThekaBook Contractor Management', 55, 52);
      doc.fontSize(10).fillColor('#94a3b8').text('WORKER MONTHLY ATTENDANCE & WAGE SLIP', 55, 74);
      doc.fillColor('#38bdf8').text(`Period: ${monthName}`, 420, 52, { align: 'right', width: 120 });
      doc.fillColor('#94a3b8').text(`Generated: ${new Date().toLocaleDateString('en-IN')}`, 420, 74, { align: 'right', width: 120 });

      // Worker Details Section
      let y = 120;
      doc.rect(40, y, 515, 50).fill('#f8fafc').stroke('#e2e8f0');
      doc.fillColor('#0f172a').fontSize(11);
      doc.text(`Worker: ${worker.name}`, 55, y + 10);
      doc.text(`Skill / Role: ${worker.skill}`, 55, y + 28);
      doc.text(`Phone: ${worker.phone || 'N/A'}`, 230, y + 10);
      doc.text(`Daily Rate: ₹${dailyRate}/day`, 230, y + 28);
      doc.text(`OT Rate: ₹${overtimeRate}/hr`, 410, y + 28);

      // Financial KPI Summary Cards
      y = 185;
      const cardWidth = 95;
      const kpis = [
        { label: 'Work Days', val: `${presentDays + halfDays * 0.5}`, color: '#0f172a' },
        { label: 'OT Hours', val: `${(totalOtMinutes / 60).toFixed(1)} hrs`, color: '#0f172a' },
        { label: 'Earned Wage', val: `₹${totalEarned.toLocaleString('en-IN')}`, color: '#059669' },
        { label: 'Advances Paid', val: `₹${totalPaid.toLocaleString('en-IN')}`, color: '#dc2626' },
        { label: 'Net Balance', val: `₹${balance.toLocaleString('en-IN')}`, color: balance >= 0 ? '#0284c7' : '#dc2626' },
      ];

      kpis.forEach((kpi, idx) => {
        const x = 40 + idx * (cardWidth + 10);
        doc.rect(x, y, cardWidth, 45).fill('#f1f5f9').stroke('#cbd5e1');
        doc.fillColor('#64748b').fontSize(8).text(kpi.label, x + 5, y + 8, { width: cardWidth - 10, align: 'center' });
        doc.fillColor(kpi.color).fontSize(10).text(kpi.val, x + 5, y + 24, { width: cardWidth - 10, align: 'center' });
      });

      // Attendance Records Table
      y = 245;
      doc.fillColor('#0f172a').fontSize(12).text('Daily Attendance Log', 40, y);
      y += 18;

      // Table Header
      doc.rect(40, y, 515, 20).fill('#e2e8f0');
      doc.fillColor('#334155').fontSize(9);
      doc.text('Date', 45, y + 5);
      doc.text('Status', 120, y + 5);
      doc.text('OT (min)', 180, y + 5);
      doc.text('Site', 250, y + 5);
      doc.text('Remarks', 380, y + 5);
      doc.text('Amount', 480, y + 5, { align: 'right', width: 70 });
      y += 20;

      // Attendance Rows
      if (attendance.length === 0) {
        doc.fillColor('#64748b').fontSize(9).text('No attendance marked for this month.', 45, y + 8);
        y += 25;
      } else {
        attendance.forEach((att, idx) => {
          if (y > 740) {
            doc.addPage();
            y = 40;
          }
          const rowBg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
          doc.rect(40, y, 515, 18).fill(rowBg);
          doc.fillColor('#1e293b').fontSize(8);
          doc.text(att.date.toISOString().slice(0, 10), 45, y + 5);
          const statusText = Number(att.units) === 1 ? 'Present (P)' : Number(att.units) === 0.5 ? 'Half Day (HD)' : 'Absent (A)';
          doc.text(statusText, 120, y + 5);
          doc.text(String(att.overtimeMinutes || 0), 180, y + 5);
          doc.text((siteMap.get(att.siteId) || 'Site').slice(0, 22), 250, y + 5);
          doc.text((att.notes || '-').slice(0, 20), 380, y + 5);
          doc.text(`₹${Number(att.amount).toLocaleString('en-IN')}`, 480, y + 5, { align: 'right', width: 70 });
          y += 18;
        });
      }

      // Payments Section
      y += 15;
      if (y > 700) {
        doc.addPage();
        y = 40;
      }

      doc.fillColor('#0f172a').fontSize(12).text('Payments & Advances Made', 40, y);
      y += 18;

      doc.rect(40, y, 515, 20).fill('#e2e8f0');
      doc.fillColor('#334155').fontSize(9);
      doc.text('Date', 45, y + 5);
      doc.text('Mode', 140, y + 5);
      doc.text('Description', 230, y + 5);
      doc.text('Amount Paid', 460, y + 5, { align: 'right', width: 90 });
      y += 20;

      if (entries.length === 0) {
        doc.fillColor('#64748b').fontSize(9).text('No payments or advances recorded for this month.', 45, y + 8);
        y += 25;
      } else {
        entries.forEach((ent, idx) => {
          if (y > 740) {
            doc.addPage();
            y = 40;
          }
          const rowBg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
          doc.rect(40, y, 515, 18).fill(rowBg);
          doc.fillColor('#1e293b').fontSize(8);
          doc.text(ent.date.toISOString().slice(0, 10), 45, y + 5);
          doc.text(ent.mode || 'CASH', 140, y + 5);
          doc.text((ent.description || 'Wage payment').slice(0, 35), 230, y + 5);
          doc.text(`₹${Number(ent.amount).toLocaleString('en-IN')}`, 460, y + 5, { align: 'right', width: 90 });
          y += 18;
        });
      }

      // Footer
      y += 20;
      if (y > 750) {
        doc.addPage();
        y = 50;
      }
      doc.rect(40, y, 515, 30).fill('#f1f5f9');
      doc.fillColor('#475569').fontSize(8).text(
        'Generated via ThekaBook • Verified Digital Ledger Record • Not a Tax Invoice',
        40,
        y + 10,
        { width: 515, align: 'center' }
      );

      doc.end();
    });
  }
}

export default WorkerPdfService;
