import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface RoomDto {
  id: number;
  code: string;
  name: string;
  floor: string;
}

export interface DeskDto {
  id: number;
  deskNumber: number;
  available: boolean;
  bookedBy?: string | null;
}

export interface BookingDto {
  id: number;
  roomCode: string;
  deskNumber: number;
  bookingDate: string;
  status: 'CONFIRMED' | 'CANCELLED';
}

export interface OcrTokenDto {
  text: string;
  left: number;
  top: number;
  width: number;
  height: number;
  confidence: number;
  page: number;
}

export interface OcrResponseDto {
  filename: string;
  pages: number;
  sourceWidth: number;
  sourceHeight: number;
  rooms: OcrTokenDto[];
  desks: OcrTokenDto[];
  tokens: OcrTokenDto[];
}

export interface LayoutImportRoom {
  code: string;
  name: string;
  floor: string;
  desks: number[];
}

export interface LayoutImportResponse {
  createdRooms: number;
  updatedRooms: number;
  createdDesks: number;
  processedRooms: number;
}

export interface AdminEmployee {
  id: number;
  employeeCode: string;
  fullName: string;
  email: string;
  role: string;
}

export interface LayoutRoomAnchorDto {
  code: string;
  x: number;
  y: number;
}

export interface LayoutDeskAnchorDto {
  roomCode: string;
  deskNumber: number;
  x: number;
  y: number;
}

export interface LayoutMetadataDto {
  layoutId: string;
  sourceWidth: number;
  sourceHeight: number;
  roomAnchors: LayoutRoomAnchorDto[];
  deskAnchors: LayoutDeskAnchorDto[];
  imageUrl: string;
}

export interface RoomAvailabilityDto {
  roomCode: string;
  totalDesks: number;
  bookedDesks: number;
  availableDesks: number;
}

export interface LayoutAdminItemDto {
  id: string;
  filename: string;
  createdAt: string;
  active: boolean;
  sourceWidth: number;
  sourceHeight: number;
}

@Injectable({ providedIn: 'root' })
export class BookingService {
  private readonly backendOrigin = 'http://localhost:8080';
  private readonly api = `${this.backendOrigin}/api`;
  private readonly aiApi = 'http://127.0.0.1:8000';

  constructor(private readonly http: HttpClient) {}

  getRooms(): Observable<RoomDto[]> {
    return this.http.get<RoomDto[]>(`${this.api}/rooms`);
  }

  getRoomDesks(roomCode: string, bookingDate: string): Observable<DeskDto[]> {
    const params = new HttpParams()
      .set('roomCode', roomCode)
      .set('bookingDate', bookingDate);
    return this.http.get<DeskDto[]>(`${this.api}/rooms/desks`, { params });
  }

  getRoomAvailability(bookingDate: string): Observable<RoomAvailabilityDto[]> {
    const params = new HttpParams().set('bookingDate', bookingDate);
    return this.http.get<RoomAvailabilityDto[]>(`${this.api}/rooms/availability`, { params });
  }

  createBooking(deskId: number, bookingDate: string): Observable<{ id: number }> {
    return this.http.post<{ id: number }>(`${this.api}/bookings`, { deskId, bookingDate });
  }

  myBookings(): Observable<BookingDto[]> {
    return this.http.get<BookingDto[]>(`${this.api}/bookings/me`);
  }

  cancelBooking(bookingId: number): Observable<{ id: number; status: string }> {
    return this.http.patch<{ id: number; status: string }>(`${this.api}/bookings/${bookingId}/cancel`, {});
  }

  deleteBooking(bookingId: number): Observable<void> {
    return this.http.delete<void>(`${this.api}/bookings/${bookingId}`);
  }

  processLayout(file: File): Observable<OcrResponseDto> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<OcrResponseDto>(`${this.aiApi}/ocr/process`, formData);
  }

  importLayout(rooms: LayoutImportRoom[]): Observable<LayoutImportResponse> {
    return this.http.post<LayoutImportResponse>(`${this.api}/admin/layout/import`, { rooms });
  }

  createEmployee(employeeCode: string, fullName: string, email: string, password: string): Observable<AdminEmployee> {
    return this.http.post<AdminEmployee>(`${this.api}/admin/users`, {
      employeeCode,
      fullName,
      email,
      password
    });
  }

  getLayoutMetadata(): Observable<LayoutMetadataDto> {
    return this.http.get<LayoutMetadataDto>(`${this.api}/rooms/layout`);
  }

  uploadLayoutAsset(file: File, metadata: Omit<LayoutMetadataDto, 'layoutId' | 'imageUrl'>): Observable<void> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('metadata', JSON.stringify(metadata));
    return this.http.post<void>(`${this.api}/admin/layout/asset`, formData);
  }

  getLayoutImageBlob(relativePath: string): Observable<Blob> {
    return this.http.get(this.toBackendUrl(relativePath), { responseType: 'blob' });
  }

  listLayoutAssets(): Observable<LayoutAdminItemDto[]> {
    return this.http.get<LayoutAdminItemDto[]>(`${this.api}/admin/layouts`);
  }

  activateLayoutAsset(layoutId: string): Observable<void> {
    return this.http.post<void>(`${this.api}/admin/layouts/${layoutId}/activate`, {});
  }

  deleteLayoutAsset(layoutId: string): Observable<void> {
    return this.http.delete<void>(`${this.api}/admin/layouts/${layoutId}`);
  }

  toBackendUrl(relativePath: string): string {
    if (relativePath.startsWith('http://') || relativePath.startsWith('https://')) {
      return relativePath;
    }
    return `${this.backendOrigin}${relativePath}`;
  }
}
