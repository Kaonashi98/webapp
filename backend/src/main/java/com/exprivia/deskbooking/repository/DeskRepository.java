package com.exprivia.deskbooking.repository;

import com.exprivia.deskbooking.entity.Desk;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DeskRepository extends JpaRepository<Desk, Long> {
	List<Desk> findByRoomCodeIgnoreCaseAndActiveTrueOrderByDeskNumberAsc(String roomCode);

	List<Desk> findByRoomCodeIgnoreCaseOrderByDeskNumberAsc(String roomCode);

	List<Desk> findByActiveTrue();
}
