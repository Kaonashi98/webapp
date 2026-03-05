package com.exprivia.deskbooking.service;

import com.exprivia.deskbooking.dto.admin.LayoutImportDtos;
import com.exprivia.deskbooking.entity.Desk;
import com.exprivia.deskbooking.entity.Room;
import com.exprivia.deskbooking.repository.DeskRepository;
import com.exprivia.deskbooking.repository.RoomRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class LayoutImportService {

    private final RoomRepository roomRepository;
    private final DeskRepository deskRepository;

    public LayoutImportService(RoomRepository roomRepository, DeskRepository deskRepository) {
        this.roomRepository = roomRepository;
        this.deskRepository = deskRepository;
    }

    @Transactional
    public Map<String, Object> importLayout(LayoutImportDtos.LayoutImportRequest request) {
        int createdRooms = 0;
        int updatedRooms = 0;
        int createdDesks = 0;

        List<Desk> currentlyActive = deskRepository.findByActiveTrue();
        for (Desk desk : currentlyActive) {
            desk.setActive(false);
        }
        if (!currentlyActive.isEmpty()) {
            deskRepository.saveAll(currentlyActive);
        }

        for (LayoutImportDtos.RoomLayout roomLayout : request.rooms()) {
            Room room;
            var existing = roomRepository.findByCodeIgnoreCase(roomLayout.code());
            if (existing.isPresent()) {
                room = existing.get();
                updatedRooms++;
            } else {
                room = new Room();
                room.setCode(roomLayout.code().toUpperCase());
                createdRooms++;
            }

            room.setName(roomLayout.name());
            room.setFloor(roomLayout.floor() == null ? "1" : roomLayout.floor());
            Room savedRoom = roomRepository.save(room);

            List<Desk> existingDesks = deskRepository.findByRoomCodeIgnoreCaseOrderByDeskNumberAsc(savedRoom.getCode());
            Map<Integer, Desk> existingByNumber = new HashMap<>();
            for (Desk existingDesk : existingDesks) {
                existingByNumber.put(existingDesk.getDeskNumber(), existingDesk);
            }

            for (Integer deskNumber : roomLayout.desks()) {
                if (deskNumber == null || deskNumber < 1 || deskNumber > 999) {
                    continue;
                }
                if (existingByNumber.containsKey(deskNumber)) {
                    Desk existingDesk = existingByNumber.get(deskNumber);
                    existingDesk.setActive(true);
                    deskRepository.save(existingDesk);
                    continue;
                }
                Desk desk = new Desk();
                desk.setRoom(savedRoom);
                desk.setDeskNumber(deskNumber);
                desk.setActive(true);
                deskRepository.save(desk);
                createdDesks++;
            }
        }

        Map<String, Object> result = new HashMap<>();
        result.put("createdRooms", createdRooms);
        result.put("updatedRooms", updatedRooms);
        result.put("createdDesks", createdDesks);
        result.put("processedRooms", request.rooms().size());
        return result;
    }
}
