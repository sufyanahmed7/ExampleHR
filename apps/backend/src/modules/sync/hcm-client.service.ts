import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface HcmBalance {
  employeeId: string;
  locationId: string;
  leaveType: string;
  totalDays: number;
  usedDays: number;
}

export interface HcmTimeOffPayload {
  employeeId: string;
  locationId: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  daysRequested: number;
  requestId: string;
}

export interface HcmBatchRecord {
  employeeId: string;
  locationId: string;
  leaveType: string;
  totalDays: number;
  usedDays: number;
}

@Injectable()
export class HcmClientService {
  private readonly logger = new Logger(HcmClientService.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;

  constructor(private readonly config: ConfigService) {
    this.baseUrl = config.get<string>('hcm.baseUrl')!;
    this.apiKey = config.get<string>('hcm.apiKey')!;
    this.timeoutMs = config.get<number>('hcm.timeoutMs')!;
  }

  async getBalance(employeeId: string, locationId: string): Promise<HcmBalance[]> {
    try {
      const res = await this.fetchWithTimeout(
        `${this.baseUrl}/hcm/balance/${employeeId}/${locationId}`,
        { method: 'GET' },
      );
      if (!res.ok) throw new Error(`HCM returned ${res.status}`);
      return res.json();
    } catch (err) {
      this.logger.warn(`HCM getBalance failed: ${(err as Error).message}`);
      throw new ServiceUnavailableException('HCM service unavailable');
    }
  }

  async submitTimeOff(payload: HcmTimeOffPayload): Promise<{ referenceId: string }> {
    try {
      const res = await this.fetchWithTimeout(`${this.baseUrl}/hcm/timeoff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': this.apiKey },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || `HCM error ${res.status}`);
      }
      return res.json();
    } catch (err) {
      this.logger.warn(`HCM submitTimeOff failed: ${(err as Error).message}`);
      throw new Error((err as Error).message);
    }
  }

  async cancelTimeOff(referenceId: string): Promise<void> {
    try {
      const res = await this.fetchWithTimeout(
        `${this.baseUrl}/hcm/timeoff/${referenceId}/cancel`,
        { method: 'PATCH' },
      );
      if (!res.ok) this.logger.warn(`HCM cancelTimeOff ${referenceId} returned ${res.status}`);
    } catch (err) {
      this.logger.warn(`HCM cancelTimeOff failed: ${(err as Error).message}`);
    }
  }

  async ingestBatch(records: HcmBatchRecord[]): Promise<void> {
    const res = await this.fetchWithTimeout(`${this.baseUrl}/hcm/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': this.apiKey },
      body: JSON.stringify({ records }),
    });
    if (!res.ok) throw new Error(`HCM batch ingest failed: ${res.status}`);
  }

  private async fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }
}
