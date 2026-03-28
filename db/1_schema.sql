-- Drop tables if they exist to allow clean re-runs
BEGIN EXECUTE IMMEDIATE 'DROP TABLE PricingRule CASCADE CONSTRAINTS'; EXCEPTION WHEN OTHERS THEN IF SQLCODE != -942 THEN RAISE; END IF; END;
/
BEGIN EXECUTE IMMEDIATE 'DROP TABLE PAYMENT CASCADE CONSTRAINTS'; EXCEPTION WHEN OTHERS THEN IF SQLCODE != -942 THEN RAISE; END IF; END;
/
BEGIN EXECUTE IMMEDIATE 'DROP TABLE TICKET CASCADE CONSTRAINTS'; EXCEPTION WHEN OTHERS THEN IF SQLCODE != -942 THEN RAISE; END IF; END;
/
BEGIN EXECUTE IMMEDIATE 'DROP TABLE VEHICLE CASCADE CONSTRAINTS'; EXCEPTION WHEN OTHERS THEN IF SQLCODE != -942 THEN RAISE; END IF; END;
/
BEGIN EXECUTE IMMEDIATE 'DROP TABLE ParkingSlot CASCADE CONSTRAINTS'; EXCEPTION WHEN OTHERS THEN IF SQLCODE != -942 THEN RAISE; END IF; END;
/
BEGIN EXECUTE IMMEDIATE 'DROP TABLE FLOOR CASCADE CONSTRAINTS'; EXCEPTION WHEN OTHERS THEN IF SQLCODE != -942 THEN RAISE; END IF; END;
/
BEGIN EXECUTE IMMEDIATE 'DROP TABLE GATE CASCADE CONSTRAINTS'; EXCEPTION WHEN OTHERS THEN IF SQLCODE != -942 THEN RAISE; END IF; END;
/
BEGIN EXECUTE IMMEDIATE 'DROP TABLE ParkingLot CASCADE CONSTRAINTS'; EXCEPTION WHEN OTHERS THEN IF SQLCODE != -942 THEN RAISE; END IF; END;
/

-- Drop old legacy tables just in case
BEGIN EXECUTE IMMEDIATE 'DROP TABLE Transactions CASCADE CONSTRAINTS'; EXCEPTION WHEN OTHERS THEN IF SQLCODE != -942 THEN RAISE; END IF; END;
/
BEGIN EXECUTE IMMEDIATE 'DROP TABLE ParkingSpots CASCADE CONSTRAINTS'; EXCEPTION WHEN OTHERS THEN IF SQLCODE != -942 THEN RAISE; END IF; END;
/

-- Create Schema Tables
CREATE TABLE ParkingLot(
    lot_id  varchar2(20) Primary key,
    name varchar2(50),
    location varchar2(50)
);

CREATE TABLE FLOOR(
    floor_id varchar2(20) Primary Key,
    lot_id varchar2(20) references ParkingLot(lot_id),
    floor_number number(2)
);

CREATE TABLE ParkingSlot(
    slot_id varchar2(20) Primary key,
    floor_id varchar2(20) references FLOOR(floor_id),
    slot_number number(5),
    slot_type varchar2(20),
    is_occupied varchar2(20) DEFAULT 'N'
);

CREATE TABLE VEHICLE(
    vehicle_id varchar2(20) Primary Key,
    vehicle_number varchar2(20),
    vehicle_type varchar2(20)
);

CREATE TABLE TICKET(
    ticket_id varchar2(20) Primary key,
    vehicle_id varchar2(20) references VEHICLE(vehicle_id),
    slot_id varchar2(20) references ParkingSlot(slot_id),
    start_time timestamp,
    end_time timestamp,
    status varchar2(20)
);

CREATE TABLE PAYMENT(
    payment_id varchar2(20) Primary Key,
    ticket_id varchar2(20) references TICKET(ticket_id),
    amount number(10, 2),
    payment_time timestamp,
    payment_mode varchar2(20)
);

CREATE TABLE GATE(
    gate_id varchar2(20) Primary key,
    lot_id varchar2(20) references ParkingLot(lot_id),
    gate_type varchar2(20)
);

CREATE TABLE PricingRule (
    vehicle_type VARCHAR2(20) PRIMARY KEY,
    hourly_rate NUMBER(10, 2)
);

-- --------------------------------------------------
-- 1. ParkingLot ↔ Floor
-- - Relationship: One-to-Many
-- - Type: Composition
-- - Meaning: One ParkingLot contains multiple Floors
-- - Floor cannot exist without ParkingLot

-- --------------------------------------------------
-- 2. Floor ↔ ParkingSlot
-- - Relationship: One-to-Many
-- - Type: Composition
-- - Meaning: One Floor contains multiple ParkingSlots
-- - Slot cannot exist without Floor

-- --------------------------------------------------
-- 3. Vehicle ↔ Ticket
-- - Relationship: One-to-Many
-- - Type: Association
-- - Meaning: One Vehicle can have multiple Tickets (history of parking)

-- --------------------------------------------------
-- 4. ParkingSlot ↔ Ticket
-- - Relationship: One-to-Many
-- - Type: Association
-- - Meaning: One Slot can be used in multiple Tickets over time
-- - At a given moment, only one ACTIVE Ticket per slot

-- --------------------------------------------------
-- 5. Ticket ↔ Payment
-- - Relationship: One-to-One
-- - Type: Association
-- - Meaning: Each Ticket has exactly one Payment after exit

-- --------------------------------------------------
-- 6. ParkingLot ↔ Gate
-- - Relationship: One-to-Many
-- - Type: Composition
-- - Meaning: One ParkingLot has multiple Gates (Entry/Exit)

-- --------------------------------------------------
-- 7. Gate ↔ Ticket
-- - Relationship: One-to-Many
-- - Type: Association
-- - Meaning:
--   - EntryGate creates Ticket
--   - ExitGate closes Ticket and triggers payment

-- --------------------------------------------------
-- 8. Vehicle ↔ ParkingSlot
-- - Relationship: Indirect (via Ticket)
-- - Type: Derived Association
-- - Meaning:
--   - Vehicle is NOT directly linked to Slot
--   - Ticket connects Vehicle and Slot

-- --------------------------------------------------
-- Insert Seed Data

-- 1. Seed ParkingLot
INSERT INTO ParkingLot (lot_id, name, location) VALUES ('L1', 'Downtown Hub', 'City Center');

-- 2. Seed Floors
INSERT INTO FLOOR (floor_id, lot_id, floor_number) VALUES ('F1', 'L1', 1);
INSERT INTO FLOOR (floor_id, lot_id, floor_number) VALUES ('F2', 'L1', 2);

-- 3. Seed Gates
INSERT INTO GATE (gate_id, lot_id, gate_type) VALUES ('G1', 'L1', 'ENTRY');
INSERT INTO GATE (gate_id, lot_id, gate_type) VALUES ('G2', 'L1', 'EXIT');

-- 4. Seed Parking Slots
INSERT INTO ParkingSlot (slot_id, floor_id, slot_number, slot_type, is_occupied) VALUES ('S1', 'F1', 101, 'CAR', 'N');
INSERT INTO ParkingSlot (slot_id, floor_id, slot_number, slot_type, is_occupied) VALUES ('S2', 'F1', 102, 'BIKE', 'Y');
INSERT INTO ParkingSlot (slot_id, floor_id, slot_number, slot_type, is_occupied) VALUES ('S3', 'F2', 201, 'CAR', 'N');

-- 5. Seed Vehicles (Fixed Typo: VEHILCE -> VEHICLE)
INSERT INTO VEHICLE (vehicle_id, vehicle_number, vehicle_type) VALUES ('V1', 'MH12AB1234', 'CAR');
INSERT INTO VEHICLE (vehicle_id, vehicle_number, vehicle_type) VALUES ('V2', 'KA01XY9876', 'BIKE');

-- 6. Seed Tickets (One active, one completed)
-- Completed Ticket for V1
INSERT INTO TICKET (ticket_id, vehicle_id, slot_id, start_time, end_time, status)
VALUES ('T1', 'V1', 'S1', CURRENT_TIMESTAMP - INTERVAL '2' HOUR, CURRENT_TIMESTAMP - INTERVAL '1' HOUR, 'CLOSED');

-- Active Ticket for V2 (Occupying S2)
INSERT INTO TICKET (ticket_id, vehicle_id, slot_id, start_time, end_time, status)
VALUES ('T2', 'V2', 'S2', CURRENT_TIMESTAMP - INTERVAL '30' MINUTE, NULL, 'ACTIVE');

-- 7. Seed Payments (Only for the completed ticket T1)
INSERT INTO PAYMENT (payment_id, ticket_id, amount, payment_time, payment_mode)
VALUES ('P1', 'T1', 100, CURRENT_TIMESTAMP - INTERVAL '1' HOUR, 'CREDIT_CARD');

-- 8. Seed Pricing Rules
INSERT INTO PricingRule VALUES ('CAR', 10.00);
INSERT INTO PricingRule VALUES ('BIKE', 5.00);
INSERT INTO PricingRule VALUES ('TRUCK', 15.00);

COMMIT;
