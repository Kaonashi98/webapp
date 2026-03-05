import { Component, OnDestroy, OnInit } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MapComponent, RoomView, DeskView, RoomAnchor, DeskAnchor } from '../map/map.component';
import { AuthService } from '../../services/auth.service';
import {
  BookingService,
  BookingDto,
  LayoutAdminItemDto,
  LayoutImportRoom,
  LayoutMetadataDto,
  OcrResponseDto,
  OcrTokenDto,
  RoomAvailabilityDto
} from '../../services/booking.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [MapComponent, FormsModule, NgIf, NgFor],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit, OnDestroy {
  userName = '';
  userRole: 'ADMIN' | 'USER' = 'USER';
  minBookingDate = this.getTomorrowDateString();
  bookingDate = this.minBookingDate;
  rooms: RoomView[] = [];
  desks: DeskView[] = [];
  selectedRoomCode: string | null = null;
  selectedDeskId: number | null = null;
  myBookings: BookingDto[] = [];
  futureBookings: BookingDto[] = [];
  pastBookings: BookingDto[] = [];
  infoMessage = '';
  errorMessage = '';
  ocrInfoMessage = '';
  ocrErrorMessage = '';
  showOcrPreview = false;
  importingLayout = false;
  parsedLayout: LayoutImportRoom[] = [];
  selectedLayoutFile: File | null = null;
  planImageUrl: string | null = null;
  roomAnchors: RoomAnchor[] = [];
  deskAnchors: DeskAnchor[] = [];
  mapSourceWidth = 816;
  mapSourceHeight = 1056;
  roomAvailabilityByCode: Record<string, { totalDesks: number; bookedDesks: number; availableDesks: number }> = {};
  currentLayoutId: string | null = null;
  layoutAssets: LayoutAdminItemDto[] = [];
  managingLayout = false;
  readonly nonSelectableRoomCodes = ['A1', 'A19', 'A23'];
  private readonly deskRoomOverrides: Record<number, string> = {
    18: 'B4',
    43: 'A6',
    44: 'A6',
    45: 'A6'
  };
  private readonly roomDeskWhitelist: Record<string, number[]> = {
    A18: [15, 16, 17],
    B4: [18],
    A5: [41, 42],
    A6: [43, 44, 45]
  };
  selectedDeskAvailable = false;
  selectedDeskNumber: number | null = null;
  employeeCode = '';
  employeeName = '';
  employeeEmail = '';
  employeePassword = '';
  employeeInfoMessage = '';
  employeeErrorMessage = '';
  latestConfirmedBookingId: number | null = null;
  private pendingBookingScrollId: number | null = null;
  private pendingCancelRemovalIds = new Set<number>();
  cancellingFutureBookingId: number | null = null;
  private deletingBookingIds = new Set<number>();

  constructor(
    private readonly authService: AuthService,
    private readonly bookingService: BookingService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.minBookingDate = this.getTomorrowDateString();
    if (this.bookingDate < this.minBookingDate) {
      this.bookingDate = this.minBookingDate;
    }

    this.authService.me().subscribe({
      next: (me) => {
        this.userName = me.fullName;
        this.userRole = me.role;
        this.loadRooms();
        this.loadBookings();
        this.loadRoomAvailability();
        this.loadLayoutAsset();
        if (this.userRole === 'ADMIN') {
          this.loadLayoutAssets();
        }
      },
      error: () => {
        this.authService.logout();
        this.router.navigate(['/login']);
      }
    });
  }

  ngOnDestroy(): void {
    if (this.planImageUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(this.planImageUrl);
    }
  }

  private loadLayoutAsset(): void {
    this.bookingService.getLayoutMetadata().subscribe({
      next: (layout) => {
        this.applyLayoutMetadata(layout);
      },
      error: () => {
        this.currentLayoutId = null;
        this.planImageUrl = null;
        this.roomAnchors = [];
        this.deskAnchors = [];
      }
    });
  }

  private loadLayoutAssets(): void {
    if (this.userRole !== 'ADMIN') {
      return;
    }
    this.bookingService.listLayoutAssets().subscribe({
      next: (items) => {
        this.layoutAssets = items;
      },
      error: () => {
        this.layoutAssets = [];
      }
    });
  }

  private loadRoomAvailability(): void {
    this.bookingService.getRoomAvailability(this.bookingDate).subscribe({
      next: (items: RoomAvailabilityDto[]) => {
        const map: Record<string, { totalDesks: number; bookedDesks: number; availableDesks: number }> = {};
        for (const item of items) {
          map[item.roomCode.toUpperCase()] = {
            totalDesks: item.totalDesks,
            bookedDesks: item.bookedDesks,
            availableDesks: item.availableDesks
          };
        }
        this.roomAvailabilityByCode = map;
      },
      error: () => {
        this.roomAvailabilityByCode = {};
      }
    });
  }

  private applyLayoutMetadata(layout: LayoutMetadataDto): void {
    this.currentLayoutId = layout.layoutId;
    this.mapSourceWidth = layout.sourceWidth || 816;
    this.mapSourceHeight = layout.sourceHeight || 1056;
    this.roomAnchors = layout.roomAnchors.map((room) => ({
      code: room.code.toUpperCase(),
      x: room.x,
      y: room.y
    }));
    this.deskAnchors = layout.deskAnchors.map((desk) => ({
      roomCode: this.resolveDeskRoomCode(desk.deskNumber, desk.roomCode),
      deskNumber: desk.deskNumber,
      x: desk.x,
      y: desk.y
    }));
    this.bookingService.getLayoutImageBlob(layout.imageUrl).subscribe({
      next: (blob) => {
        if (this.planImageUrl?.startsWith('blob:')) {
          URL.revokeObjectURL(this.planImageUrl);
        }
        this.planImageUrl = URL.createObjectURL(blob);
      },
      error: () => {
        this.planImageUrl = null;
      }
    });
  }

  loadRooms(): void {
    this.bookingService.getRooms().subscribe({
      next: (rooms) => {
        this.rooms = rooms.map((r) => ({ code: r.code, label: r.name }));
        this.loadRoomAvailability();
      },
      error: () => {
        this.errorMessage = 'Impossibile caricare le stanze';
      }
    });
  }

  onRoomSelected(roomCode: string): void {
    if (this.nonSelectableRoomCodes.includes(roomCode.toUpperCase())) {
      return;
    }
    this.selectedRoomCode = roomCode;
    this.selectedDeskId = null;
    this.infoMessage = '';
    this.errorMessage = '';
    this.loadDesks();
  }

  onRoomReset(): void {
    this.selectedRoomCode = null;
    this.selectedDeskId = null;
    this.desks = [];
  }

  onDeskSelected(deskId: number): void {
    this.selectedDeskId = deskId;
    const desk = this.desks.find((item) => item.id === deskId);
    this.selectedDeskAvailable = !!desk?.available;
    this.selectedDeskNumber = desk?.deskNumber ?? null;
    this.scrollToBookingSummary();
  }

  private scrollToBookingSummary(): void {
    setTimeout(() => {
      const target = document.getElementById('confirmBookingButton') || document.getElementById('bookingSummary');
      target?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    }, 80);
  }

  formatDate(dateValue: string): string {
    const [year, month, day] = dateValue.split('-');
    if (!year || !month || !day) {
      return dateValue;
    }
    return `${day}-${month}-${year}`;
  }

  bookingStatusLabel(status: string): string {
    if (status === 'CONFIRMED') {
      return 'PRENOTAZIONE CONFERMATA';
    }
    if (status === 'CANCELLED') {
      return 'PRENOTAZIONE CANCELLATA';
    }
    return status;
  }

  onBookingDateChange(): void {
    if (this.bookingDate < this.minBookingDate) {
      this.bookingDate = this.minBookingDate;
    }
    this.loadDesks();
    this.loadRoomAvailability();
  }

  loadDesks(): void {
    if (!this.selectedRoomCode) {
      return;
    }

    this.bookingService.getRoomDesks(this.selectedRoomCode, this.bookingDate).subscribe({
      next: (desks) => {
        this.desks = this.applyRoomDeskWhitelist(this.selectedRoomCode!, desks);
        if (this.selectedDeskId) {
          const selected = this.desks.find((item) => item.id === this.selectedDeskId);
          this.selectedDeskAvailable = !!selected?.available;
          this.selectedDeskNumber = selected?.deskNumber ?? this.selectedDeskNumber;
        }
      },
      error: () => {
        this.errorMessage = 'Impossibile caricare le postazioni';
      }
    });
  }

  createBooking(): void {
    this.infoMessage = '';
    this.errorMessage = '';

    if (!this.selectedDeskId) {
      this.errorMessage = 'Seleziona una postazione';
      return;
    }

    if (this.bookingDate < this.minBookingDate) {
      this.errorMessage = 'Puoi prenotare solo dal giorno successivo in poi';
      return;
    }

    this.bookingService.createBooking(this.selectedDeskId, this.bookingDate).subscribe({
      next: (created) => {
        this.infoMessage = 'Prenotazione confermata';
        this.selectedDeskId = null;
        this.selectedDeskNumber = null;
        this.selectedDeskAvailable = true;
        this.onRoomReset();
        this.latestConfirmedBookingId = created.id;
        this.pendingBookingScrollId = created.id;
        this.loadBookings();
        this.loadRoomAvailability();
        setTimeout(() => {
          if (this.latestConfirmedBookingId === created.id) {
            this.latestConfirmedBookingId = null;
          }
        }, 4200);
      },
      error: (err) => {
        this.errorMessage = err?.error?.message || err?.error?.detail || 'Prenotazione non riuscita';
      }
    });
  }

  loadBookings(): void {
    this.bookingService.myBookings().subscribe({
      next: (bookings) => {
        this.myBookings = bookings;
        const today = this.getTodayDateString();
        this.futureBookings = bookings
          .filter(
            (booking) =>
              booking.bookingDate >= today &&
              booking.status === 'CONFIRMED' &&
              !this.pendingCancelRemovalIds.has(booking.id)
          )
          .sort((a, b) => a.bookingDate.localeCompare(b.bookingDate));
        this.pastBookings = bookings
          .filter((booking) => booking.bookingDate < today)
          .sort((a, b) => b.bookingDate.localeCompare(a.bookingDate));

        if (this.pendingBookingScrollId) {
          const bookingId = this.pendingBookingScrollId;
          this.pendingBookingScrollId = null;
          setTimeout(() => {
            const target = document.getElementById(`future-booking-${bookingId}`) || document.getElementById('bookingSummary');
            target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 120);
        }
      },
      error: (err) => {
        this.myBookings = [];
        this.futureBookings = [];
        this.pastBookings = [];
        const message = err?.error?.message || err?.error?.detail;
        this.errorMessage = message || `Impossibile caricare le prenotazioni (HTTP ${err?.status ?? 'n/d'})`;
      }
    });
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  cancelBooking(bookingId: number): void {
    if (this.deletingBookingIds.has(bookingId)) {
      return;
    }

    this.infoMessage = '';
    this.errorMessage = '';
    this.cancellingFutureBookingId = bookingId;
    this.pendingCancelRemovalIds.add(bookingId);
    this.deletingBookingIds.add(bookingId);

    this.bookingService.cancelBooking(bookingId).subscribe({
      next: () => {
        this.infoMessage = 'Cancellazione in corso...';

        this.futureBookings = this.futureBookings.map((booking) =>
          booking.id === bookingId ? { ...booking, status: 'CANCELLED' } : booking
        );

        setTimeout(() => {
          this.infoMessage = 'Prenotazione cancellata ed eliminata definitivamente';
          this.futureBookings = this.futureBookings.filter((booking) => booking.id !== bookingId);
          this.cancellingFutureBookingId = null;
          this.pendingCancelRemovalIds.delete(bookingId);
          this.deletingBookingIds.delete(bookingId);
          this.loadBookings();
          this.loadDesks();
          this.loadRoomAvailability();
        }, 2300);
      },
      error: (err) => {
        this.cancellingFutureBookingId = null;
        this.pendingCancelRemovalIds.delete(bookingId);
        this.deletingBookingIds.delete(bookingId);
        this.errorMessage = err?.error?.message || err?.error?.detail || 'Cancellazione non riuscita';
      }
    });
  }

  private getTodayDateString(): string {
    const now = new Date();
    return this.toDateString(now);
  }

  private getTomorrowDateString(): string {
    const now = new Date();
    now.setDate(now.getDate() + 1);
    return this.toDateString(now);
  }

  private toDateString(value: Date): string {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  deletePastBooking(bookingId: number): void {
    if (this.deletingBookingIds.has(bookingId)) {
      return;
    }

    this.infoMessage = '';
    this.errorMessage = '';
    this.deletingBookingIds.add(bookingId);
    this.bookingService.deleteBooking(bookingId).subscribe({
      next: () => {
        this.infoMessage = 'Prenotazione passata eliminata';
        this.deletingBookingIds.delete(bookingId);
        this.loadBookings();
      },
      error: (err) => {
        this.deletingBookingIds.delete(bookingId);
        this.errorMessage = err?.error?.message || err?.error?.detail || 'Eliminazione prenotazione non riuscita';
      }
    });
  }

  isDeletingBooking(bookingId: number): boolean {
    return this.deletingBookingIds.has(bookingId);
  }

  onLayoutFileSelected(event: Event): void {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0] ?? null;
    this.selectedLayoutFile = file;
    this.ocrInfoMessage = '';
    this.ocrErrorMessage = '';
    this.showOcrPreview = false;

    if (this.planImageUrl) {
      URL.revokeObjectURL(this.planImageUrl);
      this.planImageUrl = null;
    }

    if (file) {
      this.planImageUrl = URL.createObjectURL(file);
    }
  }

  processLayoutFile(): void {
    this.ocrInfoMessage = '';
    this.ocrErrorMessage = '';

    if (!this.selectedLayoutFile) {
      this.ocrErrorMessage = 'Seleziona prima un file planimetria';
      return;
    }

    this.importingLayout = true;
    this.bookingService.processLayout(this.selectedLayoutFile).subscribe({
      next: (result) => {
        this.parsedLayout = this.mapOcrToLayout(result);
        this.updateInteractiveMapData(result);
        this.importingLayout = false;
        this.showOcrPreview = true;
        if (!this.parsedLayout.length) {
          this.ocrErrorMessage = 'Nessuna stanza riconosciuta dal file';
          return;
        }
        this.ocrInfoMessage = `OCR completato: ${this.parsedLayout.length} stanze rilevate`;
      },
      error: (err) => {
        this.importingLayout = false;
        this.showOcrPreview = false;
        if (err?.status === 0) {
          this.ocrErrorMessage = 'AI service non raggiungibile o CORS bloccato (controlla http://127.0.0.1:8000/health)';
          return;
        }
        this.ocrErrorMessage = err?.error?.detail || err?.error?.message || 'Elaborazione OCR non riuscita';
      }
    });
  }

  importParsedLayout(): void {
    this.ocrInfoMessage = '';
    this.ocrErrorMessage = '';

    if (!this.parsedLayout.length) {
      this.ocrErrorMessage = 'Nessun layout da importare';
      return;
    }

    this.importingLayout = true;
    this.bookingService.importLayout(this.parsedLayout).subscribe({
      next: (result) => {
        if (!this.selectedLayoutFile) {
          this.importingLayout = false;
          this.ocrInfoMessage = `Import completato: ${result.createdRooms} stanze create, ${result.updatedRooms} stanze aggiornate, ${result.createdDesks} postazioni create`;
          this.loadRooms();
          if (this.selectedRoomCode) {
            this.loadDesks();
          }
          return;
        }

        this.bookingService
          .uploadLayoutAsset(this.selectedLayoutFile, {
            sourceWidth: this.mapSourceWidth,
            sourceHeight: this.mapSourceHeight,
            roomAnchors: this.roomAnchors,
            deskAnchors: this.deskAnchors
          })
          .subscribe({
            next: () => {
              this.importingLayout = false;
              this.ocrInfoMessage = `Import completato: ${result.createdRooms} stanze create, ${result.updatedRooms} stanze aggiornate, ${result.createdDesks} postazioni create`;
              this.loadRooms();
              this.loadLayoutAsset();
              this.loadLayoutAssets();
              if (this.selectedRoomCode) {
                this.loadDesks();
              }
            },
            error: (err) => {
              this.importingLayout = false;
              const backendMessage = err?.error?.message || err?.error?.detail;
              if (err?.status === 413) {
                this.ocrErrorMessage = 'File planimetria troppo grande per il backend (limite 20MB).';
                return;
              }
              this.ocrErrorMessage = backendMessage
                ? `Layout importato ma salvataggio planimetria non riuscito: ${backendMessage}`
                : `Layout importato ma salvataggio planimetria non riuscito (HTTP ${err?.status ?? 'n/d'})`;
            }
          });
      },
      error: (err) => {
        this.importingLayout = false;
        this.ocrErrorMessage = err?.error?.message || err?.error?.detail || 'Import layout non riuscito';
      }
    });
  }

  private mapOcrToLayout(ocr: OcrResponseDto): LayoutImportRoom[] {
    const roomTokens = this.normalizeRoomTokens(ocr);

    if (!roomTokens.length) {
      return [];
    }

    const deskTokens = ocr.desks
      .filter((token) => /^\d{1,3}$/.test(token.text))
      .map((token) => ({ ...token, deskNumber: Number(token.text) }))
      .filter((token) => token.deskNumber >= 1 && token.deskNumber <= 300 && token.confidence > 25);

    const grouped = new Map<string, Set<number>>();
    for (const room of roomTokens) {
      grouped.set(room.text, new Set<number>());
    }

    for (const desk of deskTokens) {
      const nearestRoom = this.findNearestRoom(desk, roomTokens);
      if (!nearestRoom) {
        continue;
      }
      const roomCode = this.resolveDeskRoomCode(desk.deskNumber, nearestRoom.text);
      grouped.get(roomCode)?.add(desk.deskNumber);
    }

    return Array.from(grouped.entries())
      .map(([roomCode, desksSet]) => ({
        code: roomCode,
        name: `Open Space ${roomCode}`,
        floor: '1',
        desks: Array.from(desksSet).sort((a, b) => a - b)
      }))
      .filter((room) => room.desks.length > 0);
  }

  private normalizeRoomTokens(ocr: OcrResponseDto): OcrTokenDto[] {
    const roomTokens = ocr.rooms
      .filter((token) => /^[A-Z]\d{1,3}$/i.test(token.text) && token.confidence > 35)
      .map((token) => ({ ...token, text: token.text.toUpperCase() }));

    if (!roomTokens.length) {
      return [];
    }

    const byRoomCode = new Map<string, OcrTokenDto>();
    for (const room of roomTokens) {
      const existing = byRoomCode.get(room.text);
      if (!existing || room.confidence > existing.confidence) {
        byRoomCode.set(room.text, room);
      }
    }
    return Array.from(byRoomCode.values());
  }

  private updateInteractiveMapData(ocr: OcrResponseDto): void {
    const roomTokens = this.normalizeRoomTokens(ocr);

    const uniqueRooms = new Map<string, RoomAnchor>();
    for (const room of roomTokens) {
      if (!uniqueRooms.has(room.text)) {
        uniqueRooms.set(room.text, {
          code: room.text,
          x: room.left + room.width / 2,
          y: room.top + room.height / 2
        });
      }
    }
    this.roomAnchors = Array.from(uniqueRooms.values());

    const deskTokens = ocr.desks
      .filter((token) => /^\d{1,3}$/.test(token.text))
      .map((token) => ({ ...token, deskNumber: Number(token.text) }))
      .filter((token) => token.deskNumber >= 1 && token.deskNumber <= 300);

    const assignedDeskAnchors: DeskAnchor[] = [];
    for (const desk of deskTokens) {
      const nearestRoom = this.findNearestRoom(desk, roomTokens);
      if (!nearestRoom) {
        continue;
      }
      const roomCode = this.resolveDeskRoomCode(desk.deskNumber, nearestRoom.text);
      assignedDeskAnchors.push({
        roomCode,
        deskNumber: desk.deskNumber,
        x: desk.left + desk.width / 2,
        y: desk.top + desk.height / 2
      });
    }

    const dedup = new Map<string, DeskAnchor>();
    for (const anchor of assignedDeskAnchors) {
      const key = `${anchor.roomCode}-${anchor.deskNumber}`;
      if (!dedup.has(key)) {
        dedup.set(key, anchor);
      }
    }
    this.deskAnchors = Array.from(dedup.values());

    const maxX = Math.max(816, ...ocr.tokens.map((t) => t.left + Math.max(5, t.width)));
    const maxY = Math.max(1056, ...ocr.tokens.map((t) => t.top + Math.max(5, t.height)));
    this.mapSourceWidth = ocr.sourceWidth || maxX + 20;
    this.mapSourceHeight = ocr.sourceHeight || maxY + 20;
  }

  private resolveDeskRoomCode(deskNumber: number, roomCode: string): string {
    return this.deskRoomOverrides[deskNumber] ?? roomCode.toUpperCase();
  }

  private applyRoomDeskWhitelist(roomCode: string, desks: DeskView[]): DeskView[] {
    const whitelist = this.roomDeskWhitelist[roomCode.toUpperCase()];
    if (!whitelist?.length) {
      return desks;
    }
    return desks.filter((desk) => whitelist.includes(desk.deskNumber));
  }

  private findNearestRoom(desk: OcrTokenDto & { deskNumber: number }, rooms: OcrTokenDto[]): OcrTokenDto | null {
    const deskCenterX = desk.left + desk.width / 2;
    const deskCenterY = desk.top + desk.height / 2;

    let bestRoom: OcrTokenDto | null = null;
    let bestDistance = Number.MAX_VALUE;

    for (const room of rooms) {
      if (room.page !== desk.page) {
        continue;
      }
      const roomCenterX = room.left + room.width / 2;
      const roomCenterY = room.top + room.height / 2;
      const dx = deskCenterX - roomCenterX;
      const dy = deskCenterY - roomCenterY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < bestDistance) {
        bestDistance = distance;
        bestRoom = room;
      }
    }

    return bestDistance <= 120 ? bestRoom : null;
  }

  createEmployee(): void {
    this.employeeInfoMessage = '';
    this.employeeErrorMessage = '';

    if (!this.employeeCode || !this.employeeName || !this.employeeEmail || !this.employeePassword) {
      this.employeeErrorMessage = 'Compila tutti i campi dipendente';
      return;
    }

    this.bookingService
      .createEmployee(this.employeeCode, this.employeeName, this.employeeEmail, this.employeePassword)
      .subscribe({
        next: (employee) => {
          this.employeeInfoMessage = `Dipendente creato: ${employee.fullName} (${employee.employeeCode})`;
          this.employeeCode = '';
          this.employeeName = '';
          this.employeeEmail = '';
          this.employeePassword = '';
        },
        error: (err) => {
          this.employeeErrorMessage = err?.error?.message || err?.error?.detail || 'Creazione dipendente non riuscita';
        }
      });
  }

  activateLayout(layoutId: string): void {
    this.managingLayout = true;
    this.ocrInfoMessage = '';
    this.ocrErrorMessage = '';
    this.bookingService.activateLayoutAsset(layoutId).subscribe({
      next: () => {
        this.managingLayout = false;
        this.ocrInfoMessage = 'Planimetria attivata con successo';
        this.loadLayoutAsset();
        this.loadLayoutAssets();
      },
      error: (err) => {
        this.managingLayout = false;
        this.ocrErrorMessage = err?.error?.message || err?.error?.detail || 'Attivazione planimetria non riuscita';
      }
    });
  }

  deleteLayout(layoutId: string): void {
    this.managingLayout = true;
    this.ocrInfoMessage = '';
    this.ocrErrorMessage = '';
    this.bookingService.deleteLayoutAsset(layoutId).subscribe({
      next: () => {
        this.managingLayout = false;
        this.ocrInfoMessage = 'Planimetria eliminata';
        if (this.currentLayoutId === layoutId) {
          this.onRoomReset();
        }
        this.loadLayoutAsset();
        this.loadLayoutAssets();
      },
      error: (err) => {
        this.managingLayout = false;
        this.ocrErrorMessage = err?.error?.message || err?.error?.detail || 'Eliminazione planimetria non riuscita';
      }
    });
  }

  closeOcrPreview(): void {
    this.showOcrPreview = false;
  }

  reopenOcrPreview(): void {
    if (this.parsedLayout.length) {
      this.showOcrPreview = true;
    }
  }
}
