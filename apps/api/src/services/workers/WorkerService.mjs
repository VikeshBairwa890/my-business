import prisma from '../../prisma.mjs';

export class WorkerService {
  static async list(orgId) {
    return await prisma.worker.findMany({
      where: { orgId },
      orderBy: { name: 'asc' },
    });
  }

  static async getById(orgId, id) {
    const worker = await prisma.worker.findFirst({
      where: { orgId, id },
    });
    if (!worker) {
      const err = new Error('Worker not found');
      err.status = 404;
      throw err;
    }
    return worker;
  }

  static async create(orgId, data, id = undefined) {
    const dailyRate = Number(data.dailyRate ?? data.daily_rate ?? 0);
    const overtimeRate = Number(data.overtimeRate ?? data.overtime_rate ?? 0);

    return await prisma.worker.create({
      data: {
        ...(id ? { id } : {}),
        orgId,
        name: data.name.trim(),
        phone: data.phone || '',
        skill: data.skill.trim(),
        dailyRate,
        overtimeRate,
        photo: data.photo || '',
        active: data.active !== undefined ? Boolean(data.active) : true,
      },
    });
  }

  static async update(orgId, id, data) {
    await this.getById(orgId, id);

    const updateData = {};
    if (data.name !== undefined) updateData.name = data.name.trim();
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.skill !== undefined) updateData.skill = data.skill.trim();
    if (data.dailyRate !== undefined || data.daily_rate !== undefined) {
      updateData.dailyRate = Number(data.dailyRate ?? data.daily_rate);
    }
    if (data.overtimeRate !== undefined || data.overtime_rate !== undefined) {
      updateData.overtimeRate = Number(data.overtimeRate ?? data.overtime_rate);
    }
    if (data.photo !== undefined) updateData.photo = data.photo;
    if (data.active !== undefined) updateData.active = Boolean(data.active);

    return await prisma.worker.update({
      where: { id },
      data: updateData,
    });
  }
}

export default WorkerService;
