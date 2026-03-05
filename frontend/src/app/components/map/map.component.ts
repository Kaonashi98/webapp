import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface RoomView {
  code: string;
  label: string;
}

export interface DeskView {
  id: number;
  deskNumber: number;
  available: boolean;
  bookedBy?: string | null;
}

export interface RoomAnchor {
  code: string;
  x: number;
  y: number;
}

export interface DeskAnchor {
  roomCode: string;
  deskNumber: number;
  x: number;
  y: number;
}

export interface RoomAvailabilityView {
  totalDesks: number;
  availableDesks: number;
  bookedDesks: number;
}

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './map.component.html',
  styleUrl: './map.component.css'
})
export class MapComponent {
  @Input() rooms: RoomView[] = [];
  @Input() desks: DeskView[] = [];
  @Input() selectedRoomCode: string | null = null;
  @Input() selectedDeskId: number | null = null;
  @Input() planImageUrl: string | null = null;
  @Input() roomAnchors: RoomAnchor[] = [];
  @Input() deskAnchors: DeskAnchor[] = [];
  @Input() roomAvailability: Record<string, RoomAvailabilityView> = {};
  @Input() nonSelectableRooms: string[] = ['A1', 'A19', 'A23'];
  @Input() sourceWidth = 816;
  @Input() sourceHeight = 1056;

  @Output() roomSelected = new EventEmitter<string>();
  @Output() deskSelected = new EventEmitter<number>();
  @Output() roomReset = new EventEmitter<void>();
  isViewTransitioning = false;
  private transitionStartTimer: ReturnType<typeof setTimeout> | null = null;
  private transitionEndTimer: ReturnType<typeof setTimeout> | null = null;

  zoomRoom(roomCode: string): void {
    if (!this.isRoomSelectable(roomCode)) {
      return;
    }
    this.runViewTransition(() => this.roomSelected.emit(roomCode));
  }

  onRoomPointerDown(roomCode: string, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.zoomRoom(roomCode);
  }

  selectDesk(deskId: number): void {
    this.deskSelected.emit(deskId);
  }

  reset(): void {
    this.runViewTransition(() => this.roomReset.emit());
  }

  get hasInteractivePlan(): boolean {
    return !!this.planImageUrl && this.roomAnchors.length > 0;
  }

  get selectableRoomCodes(): Set<string> {
    return new Set(
      this.rooms
        .map((room) => room.code.toUpperCase())
        .filter((code) => !this.nonSelectableRooms.map((item) => item.toUpperCase()).includes(code))
    );
  }

  get visibleRoomAnchors(): RoomAnchor[] {
    const selectable = this.selectableRoomCodes;
    const dedup = new Map<string, RoomAnchor>();

    for (const anchor of this.roomAnchors) {
      const code = anchor.code.toUpperCase();
      if (!selectable.has(code)) {
        continue;
      }
      if (!dedup.has(code)) {
        dedup.set(code, { ...anchor, code });
      }
    }

    for (const roomCode of selectable) {
      if (dedup.has(roomCode)) {
        continue;
      }

      const anchors = this.deskAnchors.filter((deskAnchor) => deskAnchor.roomCode.toUpperCase() === roomCode);
      if (!anchors.length) {
        continue;
      }

      const avgX = anchors.reduce((sum, item) => sum + item.x, 0) / anchors.length;
      const avgY = anchors.reduce((sum, item) => sum + item.y, 0) / anchors.length;
      dedup.set(roomCode, { code: roomCode, x: avgX, y: avgY });
    }

    return Array.from(dedup.values());
  }

  private runViewTransition(action: () => void): void {
    if (this.transitionStartTimer) {
      clearTimeout(this.transitionStartTimer);
      this.transitionStartTimer = null;
    }
    if (this.transitionEndTimer) {
      clearTimeout(this.transitionEndTimer);
      this.transitionEndTimer = null;
    }

    this.isViewTransitioning = true;
    this.transitionStartTimer = setTimeout(() => {
      action();
      this.transitionEndTimer = setTimeout(() => {
        this.isViewTransitioning = false;
      }, 220);
    }, 120);
  }

  private isRoomSelectable(roomCode: string): boolean {
    const normalized = roomCode.toUpperCase();
    const forbidden = this.nonSelectableRooms.map((item) => item.toUpperCase());
    if (forbidden.includes(normalized)) {
      return false;
    }

    if (this.selectableRoomCodes.size === 0) {
      return true;
    }

    return this.selectableRoomCodes.has(normalized);
  }

  get selectedRoomAnchor(): RoomAnchor | null {
    if (!this.selectedRoomCode) {
      return null;
    }

    const selectedCode = this.selectedRoomCode.toUpperCase();
    const direct = this.visibleRoomAnchors.find((room) => room.code === selectedCode);
    if (direct) {
      return direct;
    }

    const anchors = this.visibleDeskAnchors;
    if (!anchors.length) {
      return null;
    }

    const avgX = anchors.reduce((sum, item) => sum + item.x, 0) / anchors.length;
    const avgY = anchors.reduce((sum, item) => sum + item.y, 0) / anchors.length;
    return { code: selectedCode, x: avgX, y: avgY };
  }

  private get roomDeskBounds(): { minX: number; maxX: number; minY: number; maxY: number } | null {
    const anchors = this.visibleDeskAnchors;
    if (!anchors.length) {
      return null;
    }

    const xs = anchors.map((item) => item.x);
    const ys = anchors.map((item) => item.y);
    return {
      minX: Math.min(...xs),
      maxX: Math.max(...xs),
      minY: Math.min(...ys),
      maxY: Math.max(...ys)
    };
  }

  get zoomScale(): number {
    const bounds = this.roomDeskBounds;
    if (!bounds) {
      return 8;
    }

    const widthPct = ((bounds.maxX - bounds.minX + 40) / this.sourceWidth) * 100;
    const heightPct = ((bounds.maxY - bounds.minY + 40) / this.sourceHeight) * 100;
    const dominant = Math.max(widthPct, heightPct, 8);
    const scale = 92 / dominant;
    return Math.max(7, Math.min(14, scale));
  }

  get markerInverseScale(): number {
    return Math.max(0.17, Math.min(0.3, 1 / this.zoomScale));
  }

  get deskMarkerTransform(): string {
    return `translate(-50%, -50%) scale(${this.markerInverseScale})`;
  }

  get zoomTransformStyle(): Record<string, string> {
    const room = this.selectedRoomAnchor;
    if (!room) {
      return {};
    }

    const bounds = this.roomDeskBounds;
    const focusX = bounds ? (bounds.minX + bounds.maxX) / 2 : room.x;
    const focusY = bounds ? (bounds.minY + bounds.maxY) / 2 : room.y;

    const zoomScale = this.zoomScale;
    const xPct = (focusX / this.sourceWidth) * 100;
    const yPct = (focusY / this.sourceHeight) * 100;

    let tx = 50 - xPct * zoomScale;
    let ty = 50 - yPct * zoomScale;

    const minShift = 100 - 100 * zoomScale;
    tx = Math.max(minShift, Math.min(0, tx));
    ty = Math.max(minShift, Math.min(0, ty));

    return {
      transform: `translate(${tx}%, ${ty}%) scale(${zoomScale})`,
      transformOrigin: 'top left'
    };
  }

  get overviewTransformStyle(): Record<string, string> {
    const roomPoints = this.visibleRoomAnchors;
    if (!roomPoints.length) {
      return {};
    }

    const xs = roomPoints.map((item) => item.x);
    const ys = roomPoints.map((item) => item.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const widthPct = ((maxX - minX + 120) / this.sourceWidth) * 100;
    const heightPct = ((maxY - minY + 120) / this.sourceHeight) * 100;
    const dominant = Math.max(widthPct, heightPct, 28);
    const scale = Math.max(1, Math.min(2.4, 95 / dominant));

    const focusX = (minX + maxX) / 2;
    const focusY = (minY + maxY) / 2;
    const xPct = (focusX / this.sourceWidth) * 100;
    const yPct = (focusY / this.sourceHeight) * 100;

    let tx = 50 - xPct * scale;
    let ty = 50 - yPct * scale;
    const minShift = 100 - 100 * scale;
    tx = Math.max(minShift, Math.min(0, tx));
    ty = Math.max(minShift, Math.min(0, ty));

    return {
      transform: `translate(${tx}%, ${ty}%) scale(${scale})`,
      transformOrigin: 'top left'
    };
  }

  get visibleDeskAnchors(): Array<DeskAnchor & { desk: DeskView | null }> {
    if (!this.selectedRoomCode) {
      return [];
    }

    const selectedCode = this.selectedRoomCode.toUpperCase();
    const roomDeskByNumber = new Map<number, DeskView>();
    for (const desk of this.desks) {
      roomDeskByNumber.set(desk.deskNumber, desk);
    }

    const numbers = new Set(Array.from(roomDeskByNumber.keys()));
    const sameRoom = this.deskAnchors.filter(
      (deskAnchor) => deskAnchor.roomCode.toUpperCase() === selectedCode && numbers.has(deskAnchor.deskNumber)
    );

    const byNumber = new Map<number, DeskAnchor>();
    for (const anchor of sameRoom) {
      if (!byNumber.has(anchor.deskNumber)) {
        byNumber.set(anchor.deskNumber, anchor);
      }
    }

    return Array.from(byNumber.values())
      .map((deskAnchor) => ({
        ...deskAnchor,
        desk: roomDeskByNumber.get(deskAnchor.deskNumber) ?? null
      }))
      .filter((item) => !!item.desk)
      .sort((a, b) => a.deskNumber - b.deskNumber);
  }

  selectDeskFromAnchor(anchor: DeskAnchor & { desk: DeskView | null }): void {
    if (!anchor.desk || !anchor.desk.available) {
      return;
    }
    this.selectDesk(anchor.desk.id);
  }

  get selectedDeskNumber(): number | null {
    if (!this.selectedDeskId) {
      return null;
    }
    const desk = this.desks.find((item) => item.id === this.selectedDeskId);
    return desk?.deskNumber ?? null;
  }

  get occupiedDeskInfos(): Array<{ deskNumber: number; employee: string }> {
    return this.desks
      .filter((desk) => !desk.available)
      .map((desk) => ({
        deskNumber: desk.deskNumber,
        employee: desk.bookedBy || 'Dipendente non disponibile'
      }))
      .sort((a, b) => a.deskNumber - b.deskNumber);
  }

  roomStatusClass(roomCode: string): string {
    const data = this.roomAvailability[roomCode.toUpperCase()];
    if (!data || data.totalDesks <= 0) {
      return 'room-free';
    }

    if (data.availableDesks <= 0) {
      return 'room-full';
    }

    if (data.availableDesks < data.totalDesks) {
      return 'room-mixed';
    }

    return 'room-free';
  }
}
