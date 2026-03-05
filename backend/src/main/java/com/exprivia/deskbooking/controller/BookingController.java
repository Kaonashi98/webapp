package com.exprivia.deskbooking.controller;

import com.exprivia.deskbooking.entity.Booking;
import com.exprivia.deskbooking.entity.User;
import com.exprivia.deskbooking.service.BookingService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.FutureOrPresent;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/bookings")
public class BookingController {

    private final BookingService bookingService;

    public BookingController(BookingService bookingService) {
        this.bookingService = bookingService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> create(@AuthenticationPrincipal User user,
                                      @Valid @RequestBody CreateBookingRequest request) {
        Booking booking = bookingService.createBooking(user, request.deskId(), request.bookingDate());
        return Map.of(
                "id", booking.getId(),
                "userId", booking.getUser().getId(),
                "deskId", booking.getDesk().getId(),
                "bookingDate", booking.getBookingDate().toString(),
                "status", booking.getStatus().name()
        );
    }

    @GetMapping("/me")
    public List<Map<String, Object>> myBookings(@AuthenticationPrincipal User user) {
        return bookingService.getUserBookings(user.getId()).stream()
                .map(booking -> {
                    Map<String, Object> payload = new HashMap<>();
                    payload.put("id", booking.getId());
                    payload.put("roomCode", booking.getDesk().getRoom().getCode());
                    payload.put("deskNumber", booking.getDesk().getDeskNumber());
                    payload.put("bookingDate", booking.getBookingDate().toString());
                    payload.put("status", booking.getStatus().name());
                    return payload;
                })
                .toList();
    }

    @PatchMapping("/{bookingId}/cancel")
    public Map<String, Object> cancel(@AuthenticationPrincipal User user,
                                      @PathVariable Long bookingId) {
        Booking booking = bookingService.cancelBooking(bookingId, user.getId());
        return Map.of(
                "id", booking.getId(),
                "status", booking.getStatus().name(),
                "cancelledAt", booking.getCancelledAt() != null ? booking.getCancelledAt().toString() : null
        );
    }

    @DeleteMapping("/{bookingId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal User user,
                       @PathVariable Long bookingId) {
        bookingService.deleteBooking(bookingId, user.getId());
    }

    public record CreateBookingRequest(
            @NotNull Long deskId,
            @NotNull @FutureOrPresent LocalDate bookingDate
    ) {
    }
}
