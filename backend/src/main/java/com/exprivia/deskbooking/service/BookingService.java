package com.exprivia.deskbooking.service;

import com.exprivia.deskbooking.entity.*;
import com.exprivia.deskbooking.repository.BookingRepository;
import com.exprivia.deskbooking.repository.DeskRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.*;
import java.util.List;

@Service
public class BookingService {

    private final BookingRepository bookingRepository;
    private final DeskRepository deskRepository;

    public BookingService(BookingRepository bookingRepository,
                          DeskRepository deskRepository) {
        this.bookingRepository = bookingRepository;
        this.deskRepository = deskRepository;
    }

    @Transactional
    public Booking createBooking(User user, Long deskId, LocalDate bookingDate) {
        Long userId = user.getId();
        LocalDate today = LocalDate.now();

        if (!bookingDate.isAfter(today)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le prenotazioni sono consentite solo dal giorno successivo.");
        }

        if (bookingDate.getDayOfWeek() == DayOfWeek.SATURDAY || bookingDate.getDayOfWeek() == DayOfWeek.SUNDAY) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le prenotazioni sono consentite solo Lun-Ven.");
        }

        if (bookingRepository.existsByUserIdAndBookingDateAndStatus(userId, bookingDate, BookingStatus.CONFIRMED)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "L'utente ha già una prenotazione per questa data.");
        }

        LocalDate weekStart = bookingDate.with(DayOfWeek.MONDAY);
        LocalDate weekEnd = bookingDate.with(DayOfWeek.FRIDAY);
        long weeklyBookings = bookingRepository.countByUserIdAndBookingDateBetween(userId, weekStart, weekEnd);
        if (weeklyBookings >= 5) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Limite massimo di 5 prenotazioni a settimana raggiunto.");
        }

        Desk desk = deskRepository.findById(deskId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Postazione non trovata"));

        if (!Boolean.TRUE.equals(desk.getActive())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Postazione non attiva");
        }

        if (bookingRepository.existsByDeskIdAndBookingDateAndStatus(deskId, bookingDate, BookingStatus.CONFIRMED)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Postazione già prenotata per la data selezionata.");
        }

        Booking booking = new Booking();
        booking.setUser(user);
        booking.setDesk(desk);
        booking.setBookingDate(bookingDate);
        booking.setStartTime(LocalTime.of(9, 0));
        booking.setEndTime(LocalTime.of(18, 0));
        booking.setStatus(BookingStatus.CONFIRMED);

        return bookingRepository.save(booking);
    }

    @Transactional
    public Booking cancelBooking(Long bookingId, Long userId) {
        Booking booking = bookingRepository.findByIdAndUserId(bookingId, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Prenotazione non trovata"));

        if (booking.getStatus() == BookingStatus.CANCELLED) {
            bookingRepository.delete(booking);
            return booking;
        }

        LocalDateTime bookingStart = LocalDateTime.of(booking.getBookingDate(), booking.getStartTime());
        LocalDateTime cancellationDeadline = bookingStart.minusHours(2);
        if (LocalDateTime.now().isAfter(cancellationDeadline)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cancellazione non consentita oltre 2 ore prima dell'inizio.");
        }

        booking.setStatus(BookingStatus.CANCELLED);
        booking.setCancelledAt(LocalDateTime.now());
        bookingRepository.delete(booking);
        return booking;
    }

    @Transactional
    public void deleteBooking(Long bookingId, Long userId) {
        Booking booking = bookingRepository.findByIdAndUserId(bookingId, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Prenotazione non trovata"));

        LocalDate today = LocalDate.now();
        boolean isPast = booking.getBookingDate().isBefore(today);
        boolean isCancelled = booking.getStatus() == BookingStatus.CANCELLED;
        if (!isPast && !isCancelled) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Puoi eliminare solo prenotazioni passate o cancellate");
        }

        bookingRepository.delete(booking);
    }

    @Transactional(readOnly = true)
    public List<Booking> getUserBookings(Long userId) {
        return bookingRepository.findDetailedByUserIdOrderByBookingDateDesc(userId);
    }
}
