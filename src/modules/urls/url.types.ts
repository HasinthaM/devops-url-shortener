export interface CreateUrlInput {
  originalUrl: string;
  expiresAt?: string | null;
}

export interface UrlEntity {
  id: string;
  originalUrl: string;
  shortCode: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date | null;
}

export interface CreateUrlResponseDto {
  shortCode: string;
  shortUrl: string;
  originalUrl: string;
  createdAt: string;
  expiresAt: string | null;
}

export interface UrlDetailsResponseDto {
  shortCode: string;
  shortUrl: string;
  originalUrl: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  expiresAt: string | null;
}
