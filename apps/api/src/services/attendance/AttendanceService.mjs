import prisma from '../../prisma.mjs';
const wages = (units, minutes, dailyRate, overtimeRate) =>
  Math.round(Number(units) * Number(dailyRate)) + Math.round((Number(minutes) * Number(overtimeRate)) / 60);

export class AttendanceService {
  static async listByDate(orgId, date) {
    const d = new Date(date);
    return await prisma.attendance.findMany({
      where: { orgId, date: d },
      include: { worker: true, site: true },
    });
  }

  static async listBySite(orgId, siteId, startDate, endDate) {
    return await prisma.attendance.findMany({
      where: {
        orgId,
        siteId,
        date: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      },
      include: { worker: true },
      orderBy: { date: 'asc' },
    });
  }

  static async save(orgId, data) {
    const siteId = data.siteId || data.site_id;
    const workerId = data.workerId || data.worker_id;
    const dateStr = data.date;
    const attendanceDate = new Date(dateStr);
    const units = Number(data.units);
    const overtimeMinutes = Number(data.overtimeMinutes ?? data.overtime_minutes ?? 0);
    const notes = data.notes || '';

    // Validate that attendance cannot be marked for future dates
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const inputDateStr = String(dateStr).slice(0, 10);
    if (inputDateStr > todayStr) {
      throw new Error('Attendance cannot be marked for future dates');
    }


    // Verify worker exists and is active
    const worker = await prisma.worker.findFirst({
      where: { orgId, id: workerId },
    });
    if (!worker) throw new Error('Worker not found');
    if (!worker.active) throw new Error('Worker is inactive');

    // Verify site exists
    const site = await prisma.site.findFirst({
      where: { orgId, id: siteId },
    });
    if (!site) throw new Error('Site not found');

    // Check existing attendance on this date across sites
    const existingSameDay = await prisma.attendance.findMany({
      where: {
        orgId,
        workerId,
        date: attendanceDate,
        siteId: { not: siteId },
      },
    });

    const otherUnits = existingSameDay.reduce((sum, a) => sum + Number(a.units), 0);
    const otherOt = existingSameDay.reduce((sum, a) => sum + a.overtimeMinutes, 0);

    if (otherUnits + units > 1.5) {
      throw new Error('Worker already assigned attendance across sites on this date');
    }
    if (otherOt + overtimeMinutes > 960) {
      throw new Error('Total overtime exceeds 16 hours');
    }

    const existingRecord = await prisma.attendance.findFirst({
      where: {
        orgId,
        siteId,
        workerId,
        date: attendanceDate,
      },
    });

    const dailyRate = Number(existingRecord?.dailyRate ?? worker.dailyRate);
    const overtimeRate = Number(existingRecord?.overtimeRate ?? worker.overtimeRate);
    const amount = wages(units, overtimeMinutes, dailyRate, overtimeRate);

    if (existingRecord) {
      return await prisma.attendance.update({
        where: { id: existingRecord.id },
        data: {
          units,
          overtimeMinutes,
          amount,
          notes,
        },
      });
    }

    return await prisma.attendance.create({
      data: {
        orgId,
        siteId,
        workerId,
        date: attendanceDate,
        units,
        overtimeMinutes,
        dailyRate,
        overtimeRate,
        amount,
        notes,
      },
    });
  }
}

export default AttendanceService;
