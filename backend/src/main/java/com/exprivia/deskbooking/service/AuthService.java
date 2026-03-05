package com.exprivia.deskbooking.service;

import com.exprivia.deskbooking.dto.AuthDtos;
import com.exprivia.deskbooking.dto.admin.AdminUserDtos;
import com.exprivia.deskbooking.entity.User;
import com.exprivia.deskbooking.entity.UserRole;
import com.exprivia.deskbooking.repository.UserRepository;
import com.exprivia.deskbooking.security.JwtService;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public AuthService(UserRepository userRepository, PasswordEncoder passwordEncoder, JwtService jwtService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    @Transactional
    public AuthDtos.AuthResponse register(AuthDtos.RegisterRequest request) {
        if (userRepository.existsByEmailIgnoreCase(request.email())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Email già registrata");
        }
        if (userRepository.existsByEmployeeCodeIgnoreCase(request.employeeCode())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Codice dipendente già registrato");
        }

        User user = new User();
        user.setEmployeeCode(request.employeeCode());
        user.setFullName(request.fullName());
        user.setEmail(request.email().toLowerCase());
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        user.setRole(UserRole.USER);

        User saved = userRepository.save(user);
        String token = jwtService.generateToken(saved.getId(), saved.getEmail(), saved.getRole().name());
        return new AuthDtos.AuthResponse(token, saved.getId(), saved.getFullName(), saved.getEmail(), saved.getRole().name());
    }

    public AuthDtos.AuthResponse login(AuthDtos.LoginRequest request) {
        User user = userRepository.findByEmailIgnoreCase(request.email())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Credenziali non valide"));

        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Credenziali non valide");
        }

        String token = jwtService.generateToken(user.getId(), user.getEmail(), user.getRole().name());
        return new AuthDtos.AuthResponse(token, user.getId(), user.getFullName(), user.getEmail(), user.getRole().name());
    }

    @Transactional
    public AdminUserDtos.EmployeeResponse createEmployee(AdminUserDtos.CreateEmployeeRequest request) {
        if (userRepository.existsByEmailIgnoreCase(request.email())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Email già registrata");
        }
        if (userRepository.existsByEmployeeCodeIgnoreCase(request.employeeCode())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Codice dipendente già registrato");
        }

        User user = new User();
        user.setEmployeeCode(request.employeeCode());
        user.setFullName(request.fullName());
        user.setEmail(request.email().toLowerCase());
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        user.setRole(UserRole.USER);

        User saved = userRepository.save(user);
        return new AdminUserDtos.EmployeeResponse(
                saved.getId(),
                saved.getEmployeeCode(),
                saved.getFullName(),
                saved.getEmail(),
                saved.getRole().name()
        );
    }
}
