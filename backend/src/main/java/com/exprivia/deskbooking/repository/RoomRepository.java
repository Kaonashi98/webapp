package com.exprivia.deskbooking.repository;

import com.exprivia.deskbooking.entity.Room;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface RoomRepository extends JpaRepository<Room, Long> {
	Optional<Room> findByCodeIgnoreCase(String code);
}
