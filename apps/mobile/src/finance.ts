// @ts-ignore
import * as Finance from '../../../shared/finance.js';

export const money: (amount: number | bigint) => string = Finance.money;
export const paise: (text: string) => number = Finance.paise;
export const wages: (units: number, overtimeMinutes: number, dailyRate: number, overtimeRate: number) => number = Finance.wages;
export const siteSummary: (site: any, attendance: any[], entries: any[]) => any = Finance.siteSummary;
export const workerSummary: (worker: any, attendance: any[], entries: any[]) => any = Finance.workerSummary;
export const reportText: (data: any, siteId?: string) => string = Finance.reportText;
