CREATE OR REPLACE FUNCTION FUNC_FIND_AVAILABLE_SLOT (
    p_vehicle_type IN VARCHAR2
) RETURN VARCHAR2 AS
    v_slot_id VARCHAR2(20);
BEGIN
    SELECT slot_id INTO v_slot_id
    FROM ParkingSlot
    WHERE is_occupied = 'N' AND slot_type = p_vehicle_type
    AND ROWNUM = 1;

    RETURN v_slot_id;
EXCEPTION
    WHEN NO_DATA_FOUND THEN
        RETURN NULL;
END;
/

CREATE OR REPLACE FUNCTION FUNC_CALCULATE_FEE (
    p_ticket_id IN VARCHAR2
) RETURN NUMBER AS
    v_start_time TIMESTAMP;
    v_end_time TIMESTAMP;
    v_vehicle_type VARCHAR2(20);
    v_hours NUMBER;
    v_rate NUMBER;
    v_fee NUMBER;
BEGIN
    v_end_time := CURRENT_TIMESTAMP;

    -- Look up the ticket and vehicle details
    SELECT t.start_time, v.vehicle_type
    INTO v_start_time, v_vehicle_type
    FROM TICKET t
    JOIN VEHICLE v ON t.vehicle_id = v.vehicle_id
    WHERE t.ticket_id = p_ticket_id AND t.status = 'ACTIVE';

    -- Calculate difference in hours
    SELECT
        EXTRACT(DAY FROM (v_end_time - v_start_time)) * 24 +
        EXTRACT(HOUR FROM (v_end_time - v_start_time)) +
        EXTRACT(MINUTE FROM (v_end_time - v_start_time)) / 60
    INTO v_hours
    FROM DUAL;

    -- Minimum charge of 1 hour
    IF v_hours < 1 THEN
        v_hours := 1;
    END IF;

    -- Fetch dynamic pricing rate from table
    BEGIN
        SELECT hourly_rate INTO v_rate FROM PricingRule WHERE vehicle_type = v_vehicle_type;
    EXCEPTION
        WHEN NO_DATA_FOUND THEN
            v_rate := 10.00; -- Fallback rate
    END;

    v_fee := ROUND(v_hours * v_rate, 2);
    RETURN v_fee;

EXCEPTION
    WHEN NO_DATA_FOUND THEN
        RAISE_APPLICATION_ERROR(-20004, 'Active ticket not found.');
END;
/

CREATE OR REPLACE PROCEDURE PROC_ISSUE_TICKET (
    p_vehicle_number IN VARCHAR2,
    p_vehicle_type IN VARCHAR2,
    p_gate_id IN VARCHAR2,
    p_ticket_id OUT VARCHAR2,
    p_slot_id OUT VARCHAR2
) AS
    v_vehicle_id VARCHAR2(20);
    v_count NUMBER;
BEGIN
    -- 1. Find an available slot
    p_slot_id := FUNC_FIND_AVAILABLE_SLOT(p_vehicle_type);

    IF p_slot_id IS NULL THEN
        RAISE_APPLICATION_ERROR(-20002, 'No available spots for the requested vehicle type.');
    END IF;

    -- 2. Find or Create Vehicle
    SELECT COUNT(*) INTO v_count FROM VEHICLE WHERE vehicle_number = p_vehicle_number;

    IF v_count = 0 THEN
        -- Generate a simple random ID for the new vehicle
        v_vehicle_id := 'V_' || DBMS_RANDOM.STRING('X', 8);
        INSERT INTO VEHICLE (vehicle_id, vehicle_number, vehicle_type)
        VALUES (v_vehicle_id, p_vehicle_number, p_vehicle_type);
    ELSE
        SELECT vehicle_id INTO v_vehicle_id
        FROM VEHICLE
        WHERE vehicle_number = p_vehicle_number
        AND ROWNUM = 1;
    END IF;

    -- 3. Create the Ticket
    p_ticket_id := 'T_' || DBMS_RANDOM.STRING('X', 8);

    INSERT INTO TICKET (ticket_id, vehicle_id, slot_id, start_time, status)
    VALUES (p_ticket_id, v_vehicle_id, p_slot_id, CURRENT_TIMESTAMP, 'ACTIVE');

END;
/

CREATE OR REPLACE PROCEDURE PROC_PROCESS_CHECKOUT (
    p_ticket_id IN VARCHAR2,
    p_payment_mode IN VARCHAR2,
    p_amount IN NUMBER
) AS
    v_payment_id VARCHAR2(20);
BEGIN
    v_payment_id := 'P_' || DBMS_RANDOM.STRING('X', 8);

    -- 1. Record the Payment
    INSERT INTO PAYMENT (payment_id, ticket_id, amount, payment_time, payment_mode)
    VALUES (v_payment_id, p_ticket_id, p_amount, CURRENT_TIMESTAMP, p_payment_mode);

    -- 2. Update the Ticket to CLOSED and set end time
    UPDATE TICKET
    SET end_time = CURRENT_TIMESTAMP,
        status = 'CLOSED'
    WHERE ticket_id = p_ticket_id;

END;
/
