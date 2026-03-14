export interface FileUploadResponse {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  resourceType: string;
  createdAt: Date;
}

export interface FileQueryParams {
  page?: number;
  limit?: number;
  resourceType?: string;
}

export interface CloudinaryUploadResult {
  secure_url: string;
  public_id: string;
  resource_type: string;
}
