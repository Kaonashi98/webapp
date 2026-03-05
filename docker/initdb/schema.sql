CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    employee_code VARCHAR(50) NOT NULL UNIQUE,
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(120) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('ADMIN', 'USER')),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rooms (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(120) NOT NULL,
    floor VARCHAR(30),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS desks (
    id BIGSERIAL PRIMARY KEY,
    room_id BIGINT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    desk_number INTEGER NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (room_id, desk_number)
);

CREATE TABLE IF NOT EXISTS bookings (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    desk_id BIGINT NOT NULL REFERENCES desks(id) ON DELETE RESTRICT,
    booking_date DATE NOT NULL,
    start_time TIME NOT NULL DEFAULT '09:00:00',
    end_time TIME NOT NULL DEFAULT '18:00:00',
    status VARCHAR(20) NOT NULL DEFAULT 'CONFIRMED' CHECK (status IN ('CONFIRMED', 'CANCELLED')),
    cancelled_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_user_day UNIQUE (user_id, booking_date),
    CONSTRAINT uq_desk_day UNIQUE (desk_id, booking_date),
    CONSTRAINT chk_booking_weekday CHECK (EXTRACT(ISODOW FROM booking_date) BETWEEN 1 AND 5),
    CONSTRAINT chk_booking_time CHECK (start_time = '09:00:00' AND end_time = '18:00:00')
);

CREATE INDEX IF NOT EXISTS idx_bookings_user_date ON bookings (user_id, booking_date);
CREATE INDEX IF NOT EXISTS idx_bookings_desk_date ON bookings (desk_id, booking_date);

INSERT INTO users (employee_code, full_name, email, password_hash, role)
VALUES
('ADM001', 'Admin Exprivia', 'admin@exprivia.local', '$2a$10$7EqJtq98hPqEX7fNZaFWoO5lC6fH0Z7LxyzKDn5XxhxL7sRKqzZoG', 'ADMIN')
ON CONFLICT (email) DO NOTHING;

INSERT INTO rooms (code, name, floor)
VALUES
('A10', 'Open Space A10', '1'),
('A22', 'Open Space A22', '1'),
('A23', 'Open Space A23', '1'),
('A26', 'Open Space A26', '1'),
('A32', 'Open Space A32', '1')
ON CONFLICT (code) DO NOTHING;

INSERT INTO desks (room_id, desk_number)
SELECT r.id, d.desk_number
FROM rooms r
JOIN (
        VALUES
            ('A10', 1), ('A10', 2), ('A10', 3), ('A10', 4), ('A10', 5),
            ('A22', 10), ('A22', 11), ('A22', 12), ('A22', 13),
            ('A23', 14), ('A23', 15), ('A23', 16),
            ('A26', 24), ('A26', 25), ('A26', 26), ('A26', 27),
            ('A32', 30), ('A32', 31), ('A32', 32), ('A32', 33), ('A32', 34)
) AS d(room_code, desk_number)
ON r.code = d.room_code
ON CONFLICT (room_id, desk_number) DO NOTHING;
