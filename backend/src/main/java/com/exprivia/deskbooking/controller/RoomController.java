package com.exprivia.deskbooking.controller;

import com.exprivia.deskbooking.dto.LayoutAssetDtos;
import com.exprivia.deskbooking.entity.BookingStatus;
import com.exprivia.deskbooking.entity.Desk;
import com.exprivia.deskbooking.repository.BookingRepository;
import com.exprivia.deskbooking.repository.DeskRepository;
import com.exprivia.deskbooking.repository.RoomRepository;
import com.exprivia.deskbooking.service.LayoutAssetService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/rooms")
public class RoomController {

    private final RoomRepository roomRepository;
    private final DeskRepository deskRepository;
    private final BookingRepository bookingRepository;
    private final LayoutAssetService layoutAssetService;

    public RoomController(RoomRepository roomRepository,
                          DeskRepository deskRepository,
                          BookingRepository bookingRepository,
                          LayoutAssetService layoutAssetService) {
        this.roomRepository = roomRepository;
        this.deskRepository = deskRepository;
        this.bookingRepository = bookingRepository;
        this.layoutAssetService = layoutAssetService;
    }

    @GetMapping
    public List<Map<String, Object>> listRooms() {
        return roomRepository.findAll().stream()
                                .map(room -> {
                                        Map<String, Object> payload = new HashMap<>();
                                        payload.put("id", room.getId());
                                        payload.put("code", room.getCode());
                                        payload.put("name", room.getName());
                                        payload.put("floor", room.getFloor());
                                        return payload;
                                })
                .toList();
    }

    @GetMapping("/availability")
    public List<Map<String, Object>> roomAvailability(@RequestParam LocalDate bookingDate) {
        return roomRepository.findAll().stream()
                .map(room -> {
                    List<Desk> desks = deskRepository.findByRoomCodeIgnoreCaseAndActiveTrueOrderByDeskNumberAsc(room.getCode());
                    int total = desks.size();
                    Set<Long> bookedIds = bookingRepository.findBookedDeskIds(room.getCode(), bookingDate, BookingStatus.CONFIRMED)
                            .stream()
                            .collect(Collectors.toSet());
                    int booked = (int) desks.stream().filter(d -> bookedIds.contains(d.getId())).count();
                    int available = Math.max(0, total - booked);

                    Map<String, Object> payload = new HashMap<>();
                    payload.put("roomCode", room.getCode());
                    payload.put("totalDesks", total);
                    payload.put("bookedDesks", booked);
                    payload.put("availableDesks", available);
                    return payload;
                })
                .toList();
    }

    @GetMapping("/desks")
    public List<Map<String, Object>> listDesksByRoom(@RequestParam String roomCode,
                                                      @RequestParam LocalDate bookingDate) {
        List<Desk> desks = deskRepository.findByRoomCodeIgnoreCaseAndActiveTrueOrderByDeskNumberAsc(roomCode);
        List<BookingRepository.DeskBookingInfo> bookings = bookingRepository
            .findDeskBookingsWithEmployee(roomCode, bookingDate, BookingStatus.CONFIRMED);
        Set<Long> bookedIds = bookings.stream().map(BookingRepository.DeskBookingInfo::getDeskId).collect(Collectors.toSet());
        Map<Long, String> bookedBy = bookings.stream().collect(Collectors.toMap(
            BookingRepository.DeskBookingInfo::getDeskId,
            BookingRepository.DeskBookingInfo::getFullName,
            (first, second) -> first
        ));

        return desks.stream()
                .map(desk -> {
                    Map<String, Object> payload = new HashMap<>();
                    payload.put("id", desk.getId());
                    payload.put("deskNumber", desk.getDeskNumber());
                    payload.put("available", !bookedIds.contains(desk.getId()));
                payload.put("bookedBy", bookedBy.get(desk.getId()));
                    return payload;
                })
                .toList();
    }

    @GetMapping("/layout")
    public LayoutAssetDtos.LayoutMetadataResponse getLayoutMetadata() {
        return layoutAssetService
                .getLayoutMetadata()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Planimetria non disponibile"));
    }

    @GetMapping("/layout/image")
    public ResponseEntity<byte[]> getLayoutImage(@RequestParam(required = false) String layoutId) {
        var payload = layoutAssetService
                .getLayoutImage(layoutId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Immagine planimetria non disponibile"));

        MediaType mediaType = MediaType.APPLICATION_OCTET_STREAM;
        try {
            mediaType = MediaType.parseMediaType(payload.contentType());
        } catch (Exception ignored) {
        }

        return ResponseEntity.ok()
                .header(HttpHeaders.CACHE_CONTROL, "no-cache, no-store, must-revalidate")
                .contentType(mediaType)
                .body(payload.bytes());
    }
}
