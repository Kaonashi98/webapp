package com.exprivia.deskbooking.dto.admin;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class AdminUserDtos {

    public record CreateEmployeeRequest(
            @NotBlank @Size(max = 50) String employeeCode,
            @NotBlank @Size(max = 150) String fullName,
            @NotBlank @Email @Size(max = 150) String email,
            @NotBlank @Size(min = 8, max = 100) String password
    ) {
    }

    public record EmployeeResponse(
            Long id,
            String employeeCode,
            String fullName,
            String email,
            String role
    ) {
    }
}
