import { randomUUID, createHash } from 'node:crypto';
import { z } from 'zod';
import { SiteService } from '../sites/SiteService.mjs';
import { WorkerService } from '../workers/WorkerService.mjs';
import { AttendanceService } from '../attendance/AttendanceService.mjs';
import { EntryService } from '../entries/EntryService.mjs';
import prisma from '../../prisma.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');

export class SyncService {
  static async getSnapshot(orgId, userId) {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true, name: true, revision: true },
    });
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, orgId: true, name: true, email: true, createdAt: true },
    });

    const [sites, workers, attendances, entries, audits] = await Promise.all([
      prisma.site.findMany({ where: { orgId }, orderBy: { createdAt: 'desc' } }),
      prisma.worker.findMany({ where: { orgId }, orderBy: { name: 'asc' } }),
      prisma.attendance.findMany({ where: { orgId }, orderBy: { date: 'asc' } }),
      prisma.entry.findMany({ where: { orgId }, orderBy: { date: 'asc' } }),
      prisma.audit.findMany({ where: { orgId }, orderBy: { createdAt: 'desc' }, take: 50 }),
    ]);

    // Format for frontend compatibility (both snake_case and camelCase)
    const formattedSites = sites.map(s => ({
      ...s,
      org_id: s.orgId,
      owner_name: s.ownerName,
      work_type: s.workType,
      contract_amount: Number(s.contractAmount),
      unit_rate: Number(s.unitRate),
      remaining_estimate: Number(s.remainingEstimate),
      start_date: s.startDate.toISOString().slice(0, 10),
      end_date: s.endDate ? s.endDate.toISOString().slice(0, 10) : null,
    }));

    const formattedWorkers = workers.map(w => ({
      ...w,
      org_id: w.orgId,
      daily_rate: Number(w.dailyRate),
      overtime_rate: Number(w.overtimeRate),
    }));

    const formattedAttendance = attendances.map(a => ({
      ...a,
      org_id: a.orgId,
      site_id: a.siteId,
      worker_id: a.workerId,
      date: a.date.toISOString().slice(0, 10),
      daily_rate: Number(a.dailyRate),
      overtime_rate: Number(a.overtimeRate),
      overtime_minutes: a.overtimeMinutes,
      amount: Number(a.amount),
    }));

    const formattedEntries = entries.map(e => ({
      ...e,
      org_id: e.orgId,
      site_id: e.siteId,
      worker_id: e.workerId,
      supplier_id: e.supplierId,
      linked_entry_id: e.linkedEntryId,
      date: e.date.toISOString().slice(0, 10),
      amount: Number(e.amount),
      voided_at: e.voidedAt,
      void_reason: e.voidReason,
    }));

    const formattedAudits = audits.map(a => ({
      action: a.action,
      entity_id: a.entityId,
      created_at: a.createdAt,
    }));

    return {
      organization: { ...org, revision: org?.revision || 0 },
      user: { ...user, org_id: user?.orgId },
      sites: formattedSites,
      workers: formattedWorkers,
      attendance: formattedAttendance,
      entries: formattedEntries,
      audit: formattedAudits,
    };
  }

  static async executeCommand(orgId, userId, command) {
    const { key, action, entity_id, data } = command;
    const digest = hash(JSON.stringify({ action, entity_id, data }));

    // Check idempotency
    const existingRequest = await prisma.request.findUnique({
      where: { orgId_key: { orgId, key } },
    });
    if (existingRequest) {
      if (existingRequest.hash !== digest) {
        const err = new Error('Request key reused with different data');
        err.status = 409;
        throw err;
      }
      return existingRequest.result;
    }

    let before = null;
    let after = null;
    let entity = entity_id || randomUUID();

    if (action.startsWith('site.')) {
      if (action === 'site.update') {
        before = await SiteService.getById(orgId, entity);
        after = await SiteService.update(orgId, entity, data);
      } else {
        after = await SiteService.create(orgId, data, entity);
      }
    } else if (action.startsWith('worker.')) {
      if (action === 'worker.update') {
        before = await WorkerService.getById(orgId, entity);
        after = await WorkerService.update(orgId, entity, data);
      } else {
        after = await WorkerService.create(orgId, data, entity);
      }
    } else if (action === 'attendance.save') {
      after = await AttendanceService.save(orgId, data);
    } else if (action === 'entry.create') {
      after = await EntryService.create(orgId, data, entity);
    } else if (action === 'profile.update') {
      if (data.name) {
        await prisma.user.update({
          where: { id: userId },
          data: { name: String(data.name).trim() },
        });
      }
      if (data.organization_name) {
        await prisma.organization.update({
          where: { id: orgId },
          data: { name: String(data.organization_name).trim() },
        });
      }
      after = { user_id: userId, name: data.name, organization_name: data.organization_name };
    } else {
      // entry.void
      after = await EntryService.void(orgId, entity, data?.reason);
    }

    // Increment revision
    await prisma.organization.update({
      where: { id: orgId },
      data: { revision: { increment: 1 } },
    });

    const response = { record: after };

    // Record audit and idempotency request
    await Promise.all([
      prisma.audit.create({
        data: {
          orgId,
          userId,
          action,
          entityId: entity,
          beforeData: before ? JSON.stringify(before) : null,
          afterData: JSON.stringify(after),
        },
      }),
      prisma.request.create({
        data: {
          orgId,
          key,
          hash: digest,
          result: response,
        },
      }),
    ]);

    return response;
  }
}

export default SyncService;
