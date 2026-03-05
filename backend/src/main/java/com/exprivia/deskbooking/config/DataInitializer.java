package com.exprivia.deskbooking.config;

import com.exprivia.deskbooking.entity.User;
import com.exprivia.deskbooking.entity.UserRole;
import com.exprivia.deskbooking.repository.UserRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;

@Configuration
public class DataInitializer {

    @Bean
    CommandLineRunner seedAdminUser(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        return args -> {
            final String adminEmail = "admin@exprivia.local";
            final String adminPassword = "password";

            User admin = userRepository.findByEmailIgnoreCase(adminEmail).orElseGet(() -> {
                User user = new User();
                user.setEmployeeCode("ADM001");
                user.setFullName("Admin Exprivia");
                user.setEmail(adminEmail);
                user.setRole(UserRole.ADMIN);
                return user;
            });

            if (!passwordEncoder.matches(adminPassword, admin.getPasswordHash() == null ? "" : admin.getPasswordHash())) {
                admin.setPasswordHash(passwordEncoder.encode(adminPassword));
            }

            userRepository.save(admin);
        };
    }
}
