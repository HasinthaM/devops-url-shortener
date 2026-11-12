export interface RecordClickInput {
  urlId: string;
  referrer?: string | null;
  userAgent?: string | null;
}

export interface UrlStatsResponse {
  shortCode: string;
  originalUrl: string;
  totalClicks: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  expiresAt: string | null;
  lastClickedAt: string | null;
}

