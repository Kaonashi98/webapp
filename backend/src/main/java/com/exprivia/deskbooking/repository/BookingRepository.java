package com.exprivia.deskbooking.repository;

import com.exprivia.deskbooking.entity.Booking;
import com.exprivia.deskbooking.entity.BookingStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface BookingRepository extends JpaRepository<Booking, Long> {
    interface DeskBookingInfo {
        Long getDeskId();

        String getFullName();
    }

    boolean existsByUserIdAndBookingDate(Long userId, LocalDate bookingDate);

    boolean existsByUserIdAndBookingDateAndStatus(Long userId, LocalDate bookingDate, BookingStatus status);

    boolean existsByDeskIdAndBookingDateAndStatus(Long deskId, LocalDate bookingDate, BookingStatus status);

    long countByUserIdAndBookingDateBetween(Long userId, LocalDate weekStart, LocalDate weekEnd);

        Optional<Booking> findByIdAndUserId(Long id, Long userId);

        @Query("""
                        select b
                        from Booking b
                        join fetch b.desk d
                        join fetch d.room r
                        where b.user.id = :userId
                        order by b.bookingDate desc, b.id desc
                        """)
        List<Booking> findDetailedByUserIdOrderByBookingDateDesc(@Param("userId") Long userId);

        @Query("""
                        select b.desk.id
                        from Booking b
                        where b.desk.room.code = :roomCode
                            and b.bookingDate = :bookingDate
                            and b.status = :status
                        """)
        List<Long> findBookedDeskIds(@Param("roomCode") String roomCode,
                                                                 @Param("bookingDate") LocalDate bookingDate,
                                                                 @Param("status") BookingStatus status);

        @Query("""
                        select b.desk.id as deskId, b.user.fullName as fullName
                        from Booking b
                        where b.desk.room.code = :roomCode
                            and b.bookingDate = :bookingDate
                            and b.status = :status
                        """)
        List<DeskBookingInfo> findDeskBookingsWithEmployee(@Param("roomCode") String roomCode,
                                                           @Param("bookingDate") LocalDate bookingDate,
                                                           @Param("status") BookingStatus status);
}
