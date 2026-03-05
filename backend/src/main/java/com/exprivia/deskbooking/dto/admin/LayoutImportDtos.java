package com.exprivia.deskbooking.dto.admin;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

public class LayoutImportDtos {

    public record RoomLayout(
            @NotBlank @Size(max = 20) String code,
            @NotBlank @Size(max = 120) String name,
            @Size(max = 30) String floor,
            @NotEmpty List<@NotNull Integer> desks
    ) {
    }

    public record LayoutImportRequest(
            @NotEmpty List<@Valid RoomLayout> rooms
    ) {
    }
}
