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

    // Fetch worker, site, and all same-day attendance records in 1 parallel round-trip
    const [worker, site, sameDayAll] = await Promise.all([
      prisma.worker.findFirst({ where: { orgId, id: workerId } }),
      prisma.site.findFirst({ where: { orgId, id: siteId } }),
      prisma.attendance.findMany({
        where: { orgId, workerId, date: attendanceDate },
      }),
    ]);

    if (!worker) throw new Error('Worker not found');
    if (!worker.active) throw new Error('Worker is inactive');
    if (!site) throw new Error('Site not found');

    const existingRecord = sameDayAll.find((a) => a.siteId === siteId) || null;
    const existingSameDay = sameDayAll.filter((a) => a.siteId !== siteId);

    const otherUnits = existingSameDay.reduce((sum, a) => sum + Number(a.units), 0);
    const otherOt = existingSameDay.reduce((sum, a) => sum + a.overtimeMinutes, 0);

    if (otherUnits + units > 1.5) {
      throw new Error('Worker already assigned attendance across sites on this date');
    }
    if (otherOt + overtimeMinutes > 960) {
      throw new Error('Total overtime exceeds 16 hours');
    }

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

  static async saveBulk(orgId, data) {
    const siteId = data.siteId || data.site_id;
    const dateStr = data.date;
    const rawItems = Array.isArray(data.items) ? data.items : [];

    if (!siteId || !dateStr || rawItems.length === 0) {
      const err = new Error('Site, date, and at least one worker are required');
      err.status = 400;
      throw err;
    }

    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const inputDateStr = String(dateStr).slice(0, 10);
    if (inputDateStr > todayStr) {
      throw new Error('Attendance cannot be marked for future dates');
    }

    const attendanceDate = new Date(dateStr);

    // Deduplicate items by workerId (last entry wins)
    const itemByWorker = new Map();
    for (const item of rawItems) {
      const workerId = item.workerId || item.worker_id;
      if (!workerId) continue;
      itemByWorker.set(workerId, {
        workerId,
        units: Number(item.units),
        overtimeMinutes: Number(item.overtimeMinutes ?? item.overtime_minutes ?? 0),
        notes: item.notes || '',
      });
    }

    const items = Array.from(itemByWorker.values());
    if (items.length === 0) {
      const err = new Error('No valid worker items provided');
      err.status = 400;
      throw err;
    }

    const workerIds = items.map((i) => i.workerId);

    // Fetch site, all workers, and all same-day attendance in 1 single parallel round-trip
    const [site, workers, sameDayAll] = await Promise.all([
      prisma.site.findFirst({ where: { orgId, id: siteId } }),
      prisma.worker.findMany({ where: { orgId, id: { in: workerIds } } }),
      prisma.attendance.findMany({
        where: { orgId, workerId: { in: workerIds }, date: attendanceDate },
      }),
    ]);

    if (!site) throw new Error('Site not found');

    const workerMap = new Map(workers.map((w) => [w.id, w]));
    const sameDayByWorker = new Map();
    for (const rec of sameDayAll) {
      const list = sameDayByWorker.get(rec.workerId) || [];
      list.push(rec);
      sameDayByWorker.set(rec.workerId, list);
    }

    const operations = [];

    for (const item of items) {
      const worker = workerMap.get(item.workerId);
      if (!worker) throw new Error('Worker not found');
      if (!worker.active) throw new Error(`Worker ${worker.name} is inactive`);

      const workerRecords = sameDayByWorker.get(item.workerId) || [];
      const existingRecord = workerRecords.find((a) => a.siteId === siteId) || null;
      const otherSiteRecords = workerRecords.filter((a) => a.siteId !== siteId);

      const otherUnits = otherSiteRecords.reduce((sum, a) => sum + Number(a.units), 0);
      const otherOt = otherSiteRecords.reduce((sum, a) => sum + a.overtimeMinutes, 0);

      if (otherUnits + item.units > 1.5) {
        throw new Error(`${worker.name} already assigned attendance across sites on this date`);
      }
      if (otherOt + item.overtimeMinutes > 960) {
        throw new Error(`Total overtime exceeds 16 hours for ${worker.name}`);
      }

      const dailyRate = Number(existingRecord?.dailyRate ?? worker.dailyRate);
      const overtimeRate = Number(existingRecord?.overtimeRate ?? worker.overtimeRate);
      const amount = wages(item.units, item.overtimeMinutes, dailyRate, overtimeRate);

      if (existingRecord) {
        operations.push(
          prisma.attendance.update({
            where: { id: existingRecord.id },
            data: {
              units: item.units,
              overtimeMinutes: item.overtimeMinutes,
              amount,
              notes: item.notes,
            },
          })
        );
      } else {
        operations.push(
          prisma.attendance.create({
            data: {
              orgId,
              siteId,
              workerId: item.workerId,
              date: attendanceDate,
              units: item.units,
              overtimeMinutes: item.overtimeMinutes,
              dailyRate,
              overtimeRate,
              amount,
              notes: item.notes,
            },
          })
        );
      }
    }

    // Execute all attendance writes atomically in a single batch transaction
    return await prisma.$transaction(operations);
  }
}

export default AttendanceService;
